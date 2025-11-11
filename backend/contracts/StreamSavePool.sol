// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IERC3009.sol";

/**
 * @title StreamSavePool
 * @notice Privacy-first savings pools with income streaming and microcredits
 * @dev Uses zero-knowledge nullifiers for participant privacy, integrated with x402 protocol
 */
contract StreamSavePool is ReentrancyGuard, Ownable {

    // ============ Structs ============

    struct Pool {
        uint256 poolId;
        bytes32 merkleRoot;           // Privacy: merkle root of participants
        uint256 contributionAmount;    // Required contribution per cycle
        uint256 streamRate;            // Tokens per second (e.g., $0.10/hour = ~0.000027 tokens/sec)
        uint256 cycleDuration;         // Duration of each payout cycle in seconds
        uint256 totalParticipants;     // Number of participants in pool
        uint256 currentRound;          // Current payout round (0-indexed)
        uint256 lastPayoutTime;        // Timestamp of last payout
        uint256 totalContributed;      // Total contributed by all participants
        bool isActive;                 // Pool active status
        address token;                 // ERC20 token for contributions (cUSD, USDC, etc.)
    }

    struct Participant {
        uint256 lastStreamTime;        // Last time stream was updated
        uint256 totalStreamed;         // Total streamed by participant
        bool hasReceivedPayout;        // Whether participant received their payout this round
        bool isActive;                 // Participant status
    }

    // ============ State Variables ============

    uint256 public nextPoolId;

    // poolId => Pool
    mapping(uint256 => Pool) public pools;

    // poolId => nullifier => Participant (privacy-preserving)
    mapping(uint256 => mapping(bytes32 => Participant)) public participants;

    // poolId => round => nullifier => claimed (prevent double claiming)
    mapping(uint256 => mapping(uint256 => mapping(bytes32 => bool))) public payoutClaimed;

    // poolId => array of nullifiers (for rotation)
    mapping(uint256 => bytes32[]) public poolNullifiers;

    // x402 facilitator address for payment verification
    address public x402Facilitator;

    // ============ Events ============

    event PoolCreated(
        uint256 indexed poolId,
        uint256 contributionAmount,
        uint256 streamRate,
        uint256 cycleDuration,
        uint256 totalParticipants
    );

    event ParticipantJoined(
        uint256 indexed poolId,
        bytes32 indexed nullifier
    );

    event StreamContribution(
        uint256 indexed poolId,
        bytes32 indexed nullifier,
        uint256 amount,
        uint256 timestamp
    );

    event PayoutDistributed(
        uint256 indexed poolId,
        uint256 indexed round,
        bytes32 indexed recipientNullifier,
        uint256 amount
    );

    event PoolCompleted(
        uint256 indexed poolId,
        uint256 totalRounds
    );

    // ============ Constructor ============

    constructor(address _x402Facilitator) Ownable(msg.sender) {
        x402Facilitator = _x402Facilitator;
        nextPoolId = 1;
    }

    // ============ Pool Management ============

    /**
     * @notice Create a new StreamSave pool
     * @param _merkleRoot Merkle root of participant nullifiers (privacy)
     * @param _contributionAmount Required contribution per cycle
     * @param _streamRate Tokens per second streaming rate
     * @param _cycleDuration Duration of each cycle in seconds
     * @param _totalParticipants Number of participants
     * @param _token ERC20 token address for contributions
     */
    function createPool(
        bytes32 _merkleRoot,
        uint256 _contributionAmount,
        uint256 _streamRate,
        uint256 _cycleDuration,
        uint256 _totalParticipants,
        address _token
    ) external returns (uint256) {
        require(_totalParticipants >= 5 && _totalParticipants <= 20, "Invalid participant count");
        require(_contributionAmount > 0, "Invalid contribution amount");
        require(_streamRate > 0, "Invalid stream rate");
        require(_cycleDuration >= 1 days, "Cycle too short");
        require(_token != address(0), "Invalid token");

        uint256 poolId = nextPoolId++;

        Pool storage pool = pools[poolId];
        pool.poolId = poolId;
        pool.merkleRoot = _merkleRoot;
        pool.contributionAmount = _contributionAmount;
        pool.streamRate = _streamRate;
        pool.cycleDuration = _cycleDuration;
        pool.totalParticipants = _totalParticipants;
        pool.currentRound = 0;
        pool.lastPayoutTime = block.timestamp;
        pool.totalContributed = 0;
        pool.isActive = true;
        pool.token = _token;

        emit PoolCreated(
            poolId,
            _contributionAmount,
            _streamRate,
            _cycleDuration,
            _totalParticipants
        );

        return poolId;
    }

    /**
     * @notice Join a pool with privacy-preserving nullifier
     * @param _poolId Pool ID to join
     * @param _nullifier Privacy-preserving nullifier (keccak256 hash)
     * @param _merkleProof Merkle proof of nullifier inclusion
     */
    function joinPool(
        uint256 _poolId,
        bytes32 _nullifier,
        bytes32[] calldata _merkleProof
    ) external {
        Pool storage pool = pools[_poolId];
        require(pool.isActive, "Pool not active");
        require(!participants[_poolId][_nullifier].isActive, "Already joined");
        require(poolNullifiers[_poolId].length < pool.totalParticipants, "Pool full");

        // Verify merkle proof (privacy check)
        require(_verifyMerkleProof(_merkleProof, pool.merkleRoot, _nullifier), "Invalid proof");

        // Initialize participant
        participants[_poolId][_nullifier] = Participant({
            lastStreamTime: block.timestamp,
            totalStreamed: 0,
            hasReceivedPayout: false,
            isActive: true
        });

        poolNullifiers[_poolId].push(_nullifier);

        emit ParticipantJoined(_poolId, _nullifier);
    }

    // ============ Streaming Contributions ============

    /**
     * @notice Stream contribution to pool (called periodically or on-demand)
     * @param _poolId Pool ID
     * @param _nullifier Participant nullifier
     * @param _amount Amount to contribute from streamed balance
     */
    function streamContribution(
        uint256 _poolId,
        bytes32 _nullifier,
        uint256 _amount
    ) external nonReentrant {
        Pool storage pool = pools[_poolId];
        Participant storage participant = participants[_poolId][_nullifier];

        require(pool.isActive, "Pool not active");
        require(participant.isActive, "Participant not active");

        // Calculate streamed amount since last update
        uint256 timeElapsed = block.timestamp - participant.lastStreamTime;
        uint256 streamedAmount = timeElapsed * pool.streamRate;

        require(_amount <= streamedAmount, "Insufficient streamed balance");

        // Update participant state
        participant.lastStreamTime = block.timestamp;
        participant.totalStreamed += _amount;

        // Transfer tokens to contract
        IERC20(pool.token).transferFrom(msg.sender, address(this), _amount);

        pool.totalContributed += _amount;

        emit StreamContribution(_poolId, _nullifier, _amount, block.timestamp);
    }

    /**
     * @notice Stream contribution using EIP-3009 transferWithAuthorization (gasless)
     * @param _poolId Pool ID
     * @param _nullifier Participant nullifier
     * @param _from Payer's address
     * @param _amount Amount to contribute
     * @param _validAfter Authorization valid after timestamp
     * @param _validBefore Authorization valid before timestamp
     * @param _nonce Unique nonce for authorization
     * @param _v Signature v component
     * @param _r Signature r component
     * @param _s Signature s component
     */
    function streamContributionWithAuth(
        uint256 _poolId,
        bytes32 _nullifier,
        address _from,
        uint256 _amount,
        uint256 _validAfter,
        uint256 _validBefore,
        bytes32 _nonce,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external nonReentrant {
        Pool storage pool = pools[_poolId];
        Participant storage participant = participants[_poolId][_nullifier];

        require(pool.isActive, "Pool not active");
        require(participant.isActive, "Participant not active");

        // Calculate streamed amount since last update
        uint256 timeElapsed = block.timestamp - participant.lastStreamTime;
        uint256 streamedAmount = timeElapsed * pool.streamRate;

        require(_amount <= streamedAmount, "Insufficient streamed balance");

        // Update participant state
        participant.lastStreamTime = block.timestamp;
        participant.totalStreamed += _amount;

        // Execute gasless transfer using EIP-3009
        IERC3009(pool.token).transferWithAuthorization(
            _from,
            address(this),
            _amount,
            _validAfter,
            _validBefore,
            _nonce,
            _v,
            _r,
            _s
        );

        pool.totalContributed += _amount;

        emit StreamContribution(_poolId, _nullifier, _amount, block.timestamp);
    }

    // ============ Payout Distribution ============

    /**
     * @notice Claim payout when it's your turn in the rotation
     * @param _poolId Pool ID
     * @param _nullifier Participant nullifier
     * @param _merkleProof Merkle proof of nullifier
     */
    function claimPayout(
        uint256 _poolId,
        bytes32 _nullifier,
        bytes32[] calldata _merkleProof
    ) external nonReentrant {
        Pool storage pool = pools[_poolId];

        require(pool.isActive, "Pool not active");
        require(_verifyMerkleProof(_merkleProof, pool.merkleRoot, _nullifier), "Invalid proof");
        require(!payoutClaimed[_poolId][pool.currentRound][_nullifier], "Already claimed");

        // Check if it's this participant's turn (round-robin based on nullifier position)
        bytes32 currentRecipient = poolNullifiers[_poolId][pool.currentRound % pool.totalParticipants];
        require(_nullifier == currentRecipient, "Not your turn");

        // Check if enough time has passed and contributions met
        require(block.timestamp >= pool.lastPayoutTime + pool.cycleDuration, "Cycle not complete");

        // Calculate payout amount (total pool contributions)
        uint256 payoutAmount = pool.contributionAmount * pool.totalParticipants;
        require(pool.totalContributed >= payoutAmount, "Insufficient contributions");

        // Mark as claimed
        payoutClaimed[_poolId][pool.currentRound][_nullifier] = true;
        participants[_poolId][_nullifier].hasReceivedPayout = true;

        // Transfer payout
        IERC20(pool.token).transfer(msg.sender, payoutAmount);

        // Update pool state
        pool.currentRound++;
        pool.lastPayoutTime = block.timestamp;
        pool.totalContributed -= payoutAmount;

        emit PayoutDistributed(_poolId, pool.currentRound - 1, _nullifier, payoutAmount);

        // Check if pool is complete (all participants received payout)
        if (pool.currentRound >= pool.totalParticipants) {
            pool.isActive = false;
            emit PoolCompleted(_poolId, pool.currentRound);
        }
    }

    // ============ View Functions ============

    function getPoolInfo(uint256 _poolId) external view returns (Pool memory) {
        return pools[_poolId];
    }

    function getParticipantInfo(uint256 _poolId, bytes32 _nullifier)
        external
        view
        returns (Participant memory)
    {
        return participants[_poolId][_nullifier];
    }

    function getStreamedBalance(uint256 _poolId, bytes32 _nullifier)
        external
        view
        returns (uint256)
    {
        Participant memory participant = participants[_poolId][_nullifier];
        Pool memory pool = pools[_poolId];

        if (!participant.isActive) return 0;

        uint256 timeElapsed = block.timestamp - participant.lastStreamTime;
        return timeElapsed * pool.streamRate;
    }

    function getCurrentRecipient(uint256 _poolId) external view returns (bytes32) {
        Pool memory pool = pools[_poolId];
        if (pool.currentRound >= pool.totalParticipants) return bytes32(0);
        return poolNullifiers[_poolId][pool.currentRound % pool.totalParticipants];
    }

    // ============ Admin Functions ============

    function updateX402Facilitator(address _newFacilitator) external onlyOwner {
        x402Facilitator = _newFacilitator;
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
