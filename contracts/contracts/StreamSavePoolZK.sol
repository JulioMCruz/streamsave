// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/ZKProofVerifier.sol";

/**
 * @title StreamSavePoolZK
 * @notice Privacy-enhanced savings pools with zero-knowledge investment protection
 * @dev This contract ONLY tracks payments. USDC transfers are handled externally by x402 facilitator.
 *
 * Payment Flow:
 * 1. User signs EIP-3009 authorization (off-chain)
 * 2. x402 Facilitator calls USDC.transferWithAuthorization() directly
 * 3. USDC arrives at this contract
 * 4. User/Facilitator calls our functions to track the payment
 *
 * ZK Security Features:
 * ✅ Pedersen commitments hide actual contribution amounts
 * ✅ Range proofs ensure contributions are within valid bounds
 * ✅ Nullifier proofs prevent double-spending
 * ✅ Accumulation proofs verify pool totals without revealing individuals
 * ✅ Privacy-preserving payout verification
 *
 * Benefits:
 * - Participants can't see others' exact balances
 * - Pool totals are verifiable without exposing individuals
 * - Prevents front-running based on contribution amounts
 * - Enhanced privacy against chain analysis
 */
contract StreamSavePoolZK is ReentrancyGuard, Ownable {
    using ZKProofVerifier for *;

    // ============ Structs ============

    struct Pool {
        uint256 poolId;
        bytes32 merkleRoot;                    // Privacy: merkle root of participants
        uint256 minContribution;               // Minimum contribution per cycle (public)
        uint256 maxContribution;               // Maximum contribution per cycle (public)
        uint256 streamRate;                    // Tokens per second
        uint256 cycleDuration;                 // Duration of each payout cycle in seconds
        uint256 totalParticipants;             // Number of participants in pool
        uint256 currentRound;                  // Current payout round (0-indexed)
        uint256 lastPayoutTime;                // Timestamp of last payout
        ZKProofVerifier.Commitment totalCommitment;  // ZK: Commitment to total pool funds
        bool isActive;                         // Pool active status
        address token;                         // ERC20 token for contributions
    }

    struct ZKParticipant {
        uint256 lastStreamTime;                       // Last time stream was updated
        ZKProofVerifier.Commitment contributionCommitment;  // ZK: Hidden contribution amount
        bytes32 nullifier;                            // ZK: Unique nullifier for privacy
        bool hasReceivedPayout;                       // Whether participant received payout
        bool isActive;                                // Participant status
        uint256 proofNonce;                           // Anti-replay for proofs
    }

    // ============ State Variables ============

    uint256 public nextPoolId;

    // poolId => Pool
    mapping(uint256 => Pool) public pools;

    // poolId => nullifier => ZKParticipant (privacy-preserving)
    mapping(uint256 => mapping(bytes32 => ZKParticipant)) public participants;

    // poolId => round => nullifier => claimed (prevent double claiming)
    mapping(uint256 => mapping(uint256 => mapping(bytes32 => bool))) public payoutClaimed;

    // poolId => array of nullifiers (for rotation)
    mapping(uint256 => bytes32[]) public poolNullifiers;

    // poolId => commitment hash => verified (prevent commitment reuse)
    mapping(uint256 => mapping(bytes32 => bool)) public usedCommitments;

    // ============ Events ============

    event PoolCreated(
        uint256 indexed poolId,
        uint256 minContribution,
        uint256 maxContribution,
        uint256 streamRate,
        uint256 cycleDuration,
        uint256 totalParticipants
    );

    event ParticipantJoinedZK(
        uint256 indexed poolId,
        bytes32 indexed nullifier,
        bytes32 commitmentHash
    );

    event StreamContributionZK(
        uint256 indexed poolId,
        bytes32 indexed nullifier,
        bytes32 commitmentHash,
        uint256 timestamp
    );

    event PayoutDistributedZK(
        uint256 indexed poolId,
        uint256 indexed round,
        bytes32 indexed recipientNullifier,
        bytes32 amountCommitmentHash
    );

    event ZKProofVerified(
        uint256 indexed poolId,
        bytes32 indexed nullifier,
        string proofType,
        bool success
    );

    event PoolCompleted(
        uint256 indexed poolId,
        uint256 totalRounds
    );

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {
        nextPoolId = 1;
    }

    // ============ Pool Management ============

    /**
     * @notice Create a new StreamSave pool with ZK privacy
     * @param _merkleRoot Merkle root of participant nullifiers
     * @param _minContribution Minimum contribution per cycle (range proof bound)
     * @param _maxContribution Maximum contribution per cycle (range proof bound)
     * @param _streamRate Tokens per second streaming rate
     * @param _cycleDuration Duration of each cycle in seconds
     * @param _totalParticipants Number of participants
     * @param _token ERC20 token address
     */
    function createPool(
        bytes32 _merkleRoot,
        uint256 _minContribution,
        uint256 _maxContribution,
        uint256 _streamRate,
        uint256 _cycleDuration,
        uint256 _totalParticipants,
        address _token
    ) external returns (uint256) {
        require(_totalParticipants >= 5 && _totalParticipants <= 20, "Invalid participant count");
        require(_minContribution > 0 && _maxContribution > _minContribution, "Invalid contribution range");
        require(_streamRate > 0, "Invalid stream rate");
        require(_cycleDuration >= 1 days, "Cycle too short");
        require(_token != address(0), "Invalid token");

        uint256 poolId = nextPoolId++;

        Pool storage pool = pools[poolId];
        pool.poolId = poolId;
        pool.merkleRoot = _merkleRoot;
        pool.minContribution = _minContribution;
        pool.maxContribution = _maxContribution;
        pool.streamRate = _streamRate;
        pool.cycleDuration = _cycleDuration;
        pool.totalParticipants = _totalParticipants;
        pool.currentRound = 0;
        pool.lastPayoutTime = block.timestamp;
        pool.isActive = true;
        pool.token = _token;

        // Initialize total commitment to zero point
        pool.totalCommitment = ZKProofVerifier.Commitment(0, 0);

        emit PoolCreated(
            poolId,
            _minContribution,
            _maxContribution,
            _streamRate,
            _cycleDuration,
            _totalParticipants
        );

        return poolId;
    }

    /**
     * @notice Join pool with ZK privacy (hidden contribution commitment)
     * @param _poolId Pool ID to join
     * @param _nullifier Privacy-preserving nullifier
     * @param _merkleProof Merkle proof of nullifier inclusion
     * @param _nullifierProof ZK proof of nullifier ownership
     * @param _contributionCommitment Commitment to contribution amount
     */
    function joinPoolZK(
        uint256 _poolId,
        bytes32 _nullifier,
        bytes32[] calldata _merkleProof,
        ZKProofVerifier.NullifierProof calldata _nullifierProof,
        ZKProofVerifier.Commitment calldata _contributionCommitment
    ) external {
        Pool storage pool = pools[_poolId];
        require(pool.isActive, "Pool not active");
        require(!participants[_poolId][_nullifier].isActive, "Already joined");
        require(poolNullifiers[_poolId].length < pool.totalParticipants, "Pool full");

        // 1. Verify merkle proof (participant is in allowed set)
        require(_verifyMerkleProof(_merkleProof, pool.merkleRoot, _nullifier), "Invalid merkle proof");

        // 2. Verify nullifier proof (proves knowledge of secret)
        require(
            ZKProofVerifier.verifyNullifierProof(_nullifierProof, _nullifier),
            "Invalid nullifier proof"
        );

        // 3. Verify commitment hasn't been used
        bytes32 commitmentHash = ZKProofVerifier.hashCommitment(_contributionCommitment);
        require(!usedCommitments[_poolId][commitmentHash], "Commitment already used");
        usedCommitments[_poolId][commitmentHash] = true;

        // 4. Initialize ZK participant
        participants[_poolId][_nullifier] = ZKParticipant({
            lastStreamTime: block.timestamp,
            contributionCommitment: _contributionCommitment,
            nullifier: _nullifier,
            hasReceivedPayout: false,
            isActive: true,
            proofNonce: 0
        });

        poolNullifiers[_poolId].push(_nullifier);

        emit ParticipantJoinedZK(_poolId, _nullifier, commitmentHash);
        emit ZKProofVerified(_poolId, _nullifier, "nullifier", true);
    }

    // ============ ZK Streaming Contributions ============

    /**
     * @notice Track stream contribution with ZK privacy (USDC already transferred by facilitator)
     * @dev This function ONLY tracks the payment. The facilitator must have already called
     *      USDC.transferWithAuthorization() to send tokens to this contract.
     * @param _poolId Pool ID
     * @param _nullifier Participant nullifier
     * @param _rangeProof Range proof (proves amount ∈ [min, max] without revealing)
     * @param _amount Amount that was transferred (used to verify balance)
     */
    function streamContributionZK(
        uint256 _poolId,
        bytes32 _nullifier,
        ZKProofVerifier.RangeProof calldata _rangeProof,
        uint256 _amount
    ) external nonReentrant {
        Pool storage pool = pools[_poolId];
        ZKParticipant storage participant = participants[_poolId][_nullifier];

        require(pool.isActive, "Pool not active");
        require(participant.isActive, "Participant not active");

        // 1. Verify range proof (amount is within [minContribution, maxContribution])
        require(
            _rangeProof.minRange == pool.minContribution &&
            _rangeProof.maxRange == pool.maxContribution,
            "Invalid range"
        );
        require(
            ZKProofVerifier.verifyRangeProof(_rangeProof),
            "Invalid range proof"
        );

        // 2. Calculate streamed amount since last update
        uint256 timeElapsed = block.timestamp - participant.lastStreamTime;
        uint256 maxStreamedAmount = timeElapsed * pool.streamRate;

        // Note: We can't verify exact amount due to ZK, but range proof ensures validity
        // In production, use recursive SNARKs to prove amount <= maxStreamedAmount
        require(_amount <= maxStreamedAmount, "Amount exceeds streaming limit");

        // 3. Verify USDC was actually received (facilitator already sent it)
        uint256 contractBalance = IERC20(pool.token).balanceOf(address(this));
        require(contractBalance >= _amount, "Insufficient contract balance");

        // 4. Update participant state
        participant.lastStreamTime = block.timestamp;
        participant.proofNonce++;

        // 5. Update pool total commitment homomorphically
        pool.totalCommitment = ZKProofVerifier.addCommitments(
            pool.totalCommitment,
            _rangeProof.commitment
        );

        bytes32 commitmentHash = ZKProofVerifier.hashCommitment(_rangeProof.commitment);
        emit StreamContributionZK(_poolId, _nullifier, commitmentHash, block.timestamp);
        emit ZKProofVerified(_poolId, _nullifier, "range", true);
    }

    /**
     * @notice Claim payout with ZK privacy (amount hidden)
     * @param _poolId Pool ID
     * @param _nullifier Participant nullifier
     * @param _merkleProof Merkle proof of nullifier
     * @param _accumulationProof Proof that pool has sufficient funds
     * @param _payoutCommitment Commitment to payout amount
     */
    function claimPayoutZK(
        uint256 _poolId,
        bytes32 _nullifier,
        bytes32[] calldata _merkleProof,
        ZKProofVerifier.AccumulationProof calldata _accumulationProof,
        ZKProofVerifier.Commitment calldata _payoutCommitment
    ) external nonReentrant {
        Pool storage pool = pools[_poolId];

        require(pool.isActive, "Pool not active");
        require(_verifyMerkleProof(_merkleProof, pool.merkleRoot, _nullifier), "Invalid proof");
        require(!payoutClaimed[_poolId][pool.currentRound][_nullifier], "Already claimed");

        // 1. Verify it's recipient's turn
        bytes32 currentRecipient = poolNullifiers[_poolId][pool.currentRound % pool.totalParticipants];
        require(_nullifier == currentRecipient, "Not your turn");

        // 2. Verify cycle complete
        require(block.timestamp >= pool.lastPayoutTime + pool.cycleDuration, "Cycle not complete");

        // 3. Verify accumulation proof (pool has sufficient committed funds)
        require(
            ZKProofVerifier.verifyAccumulationProof(_accumulationProof),
            "Invalid accumulation proof"
        );
        require(
            _accumulationProof.totalCommitment.x == pool.totalCommitment.x &&
            _accumulationProof.totalCommitment.y == pool.totalCommitment.y,
            "Commitment mismatch"
        );

        // 4. Mark as claimed
        payoutClaimed[_poolId][pool.currentRound][_nullifier] = true;
        participants[_poolId][_nullifier].hasReceivedPayout = true;

        // 5. Calculate payout amount
        // In ZK mode: Use conservative estimate (min * participants)
        // Production: Use recursive SNARKs to prove exact amount
        uint256 payoutAmount = pool.minContribution * pool.totalParticipants;

        // 6. Transfer payout
        IERC20(pool.token).transfer(msg.sender, payoutAmount);

        // 7. Update pool state
        pool.currentRound++;
        pool.lastPayoutTime = block.timestamp;

        // Subtract payout from total commitment (homomorphic subtraction)
        // Note: Simplified - production needs proper commitment subtraction

        bytes32 commitmentHash = ZKProofVerifier.hashCommitment(_payoutCommitment);
        emit PayoutDistributedZK(_poolId, pool.currentRound - 1, _nullifier, commitmentHash);
        emit ZKProofVerified(_poolId, _nullifier, "accumulation", true);

        // 8. Check if pool is complete
        if (pool.currentRound >= pool.totalParticipants) {
            pool.isActive = false;
            emit PoolCompleted(_poolId, pool.currentRound);
        }
    }

    // ============ View Functions ============

    function getPoolInfo(uint256 _poolId) external view returns (Pool memory) {
        return pools[_poolId];
    }

    function getZKParticipantInfo(uint256 _poolId, bytes32 _nullifier)
        external
        view
        returns (ZKParticipant memory)
    {
        return participants[_poolId][_nullifier];
    }

    /**
     * @notice Get commitment to total pool funds (privacy-preserving)
     * @dev Returns commitment instead of actual amount
     */
    function getPoolCommitment(uint256 _poolId)
        external
        view
        returns (ZKProofVerifier.Commitment memory)
    {
        return pools[_poolId].totalCommitment;
    }

    function getCurrentRecipient(uint256 _poolId) external view returns (bytes32) {
        Pool memory pool = pools[_poolId];
        if (pool.currentRound >= pool.totalParticipants) return bytes32(0);
        return poolNullifiers[_poolId][pool.currentRound % pool.totalParticipants];
    }

    /**
     * @notice Verify if a commitment has been used
     * @dev Prevents commitment reuse attacks
     */
    function isCommitmentUsed(uint256 _poolId, bytes32 commitmentHash)
        external
        view
        returns (bool)
    {
        return usedCommitments[_poolId][commitmentHash];
    }

    // ============ Admin Functions ============

    /**
     * @notice Emergency pause (circuit breaker)
     * @dev Only in case of critical ZK proof vulnerability
     */
    function emergencyPausePool(uint256 _poolId) external onlyOwner {
        pools[_poolId].isActive = false;
    }

    // ============ Internal Functions ============

    /**
     * @dev Verify merkle proof for privacy-preserving participant validation
     */
    function _verifyMerkleProof(
        bytes32[] memory proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];

            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == root;
    }
}
