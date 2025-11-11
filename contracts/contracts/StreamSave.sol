// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StreamSaveROSCA
 * @notice Single ROSCA (Rotating Savings and Credit Association) contract
 * @dev One contract deployment per ROSCA group. Participants sign, facilitator transfers, contract auto-pays winner.
 *
 * Architecture:
 * - Each ROSCA = Separate contract deployment
 * - Participant signs EIP-3009 → x402 facilitator transfers USDC to THIS contract
 * - Contract automatically pays out winner when cycle completes
 * - Privacy-preserving with nullifiers
 *
 * Payment Flow:
 * 1. Participant signs EIP-3009 authorization (off-chain)
 * 2. x402 Facilitator calls USDC.transferWithAuthorization() to send USDC here
 * 3. Participant calls trackContribution() to record payment
 * 4. When cycle completes, winner calls claimPayout() → contract sends USDC automatically
 */
contract StreamSaveROSCA is ReentrancyGuard {

    // ============ Structs ============

    struct Participant {
        address payoutAddress;         // Address to receive payout
        uint256 lastStreamTime;        // Last time stream was updated
        uint256 totalStreamed;         // Total streamed by participant
        bool hasReceivedPayout;        // Whether participant received their payout
        bool isActive;                 // Participant status
        uint256 joinedAt;              // Timestamp when joined
    }

    // ============ Immutable State ============

    address public immutable token;                 // USDC token address
    bytes32 public immutable merkleRoot;            // Privacy: merkle root of participants
    uint256 public immutable contributionAmount;    // Required contribution per cycle
    uint256 public immutable streamRate;            // Tokens per second
    uint256 public immutable cycleDuration;         // Duration of each payout cycle in seconds
    uint256 public immutable totalParticipants;     // Number of participants
    uint256 public immutable createdAt;             // Contract creation timestamp

    // ============ Mutable State ============

    uint256 public currentRound;                    // Current payout round (0-indexed)
    uint256 public lastPayoutTime;                  // Timestamp of last payout
    uint256 public totalContributed;                // Total contributed by all participants
    bool public isActive;                           // ROSCA active status
    uint256 public participantCount;                // Current number of joined participants

    // nullifier => Participant (privacy-preserving)
    mapping(bytes32 => Participant) public participants;

    // round => nullifier => claimed (prevent double claiming)
    mapping(uint256 => mapping(bytes32 => bool)) public payoutClaimed;

    // round => nullifier => contributed (track who paid this round)
    mapping(uint256 => mapping(bytes32 => bool)) public roundContributions;

    // round => count of contributions
    mapping(uint256 => uint256) public roundContributionCount;

    // Array of nullifiers (for rotation)
    bytes32[] public participantNullifiers;

    // ============ Events ============

    event ParticipantJoined(
        bytes32 indexed nullifier,
        address indexed payoutAddress
    );

    event ContributionTracked(
        bytes32 indexed nullifier,
        uint256 amount,
        uint256 timestamp
    );

    event PayoutDistributed(
        uint256 indexed round,
        bytes32 indexed recipientNullifier,
        address indexed recipient,
        uint256 amount,
        bool automatic
    );

    event ROSCACompleted(
        uint256 totalRounds,
        uint256 completedAt
    );

    event AutoPayoutTriggered(
        uint256 indexed round,
        bytes32 indexed recipientNullifier,
        uint256 contributionCount
    );

    // ============ Constructor ============

    /**
     * @notice Create a new ROSCA contract
     * @param _token USDC token address
     * @param _merkleRoot Merkle root of participant nullifiers
     * @param _contributionAmount Required contribution per cycle
     * @param _streamRate Tokens per second streaming rate
     * @param _cycleDuration Duration of each cycle in seconds
     * @param _totalParticipants Number of participants
     */
    constructor(
        address _token,
        bytes32 _merkleRoot,
        uint256 _contributionAmount,
        uint256 _streamRate,
        uint256 _cycleDuration,
        uint256 _totalParticipants
    ) {
        require(_token != address(0), "Invalid token");
        require(_totalParticipants >= 5 && _totalParticipants <= 20, "Invalid participant count");
        require(_contributionAmount > 0, "Invalid contribution amount");
        require(_streamRate > 0, "Invalid stream rate");
        require(_cycleDuration >= 1 days, "Cycle too short");

        token = _token;
        merkleRoot = _merkleRoot;
        contributionAmount = _contributionAmount;
        streamRate = _streamRate;
        cycleDuration = _cycleDuration;
        totalParticipants = _totalParticipants;

        createdAt = block.timestamp;
        lastPayoutTime = block.timestamp;
        currentRound = 0;
        isActive = true;
        participantCount = 0;
    }

    // ============ Participant Management ============

    /**
     * @notice Join ROSCA with privacy-preserving nullifier
     * @param _nullifier Privacy-preserving nullifier
     * @param _payoutAddress Address to receive payout
     * @param _merkleProof Merkle proof of nullifier inclusion
     */
    function joinROSCA(
        bytes32 _nullifier,
        address _payoutAddress,
        bytes32[] calldata _merkleProof
    ) external {
        require(isActive, "ROSCA not active");
        require(!participants[_nullifier].isActive, "Already joined");
        require(participantCount < totalParticipants, "ROSCA full");
        require(_payoutAddress != address(0), "Invalid payout address");

        // Verify merkle proof (participant is in allowed set)
        require(_verifyMerkleProof(_merkleProof, merkleRoot, _nullifier), "Invalid merkle proof");

        // Initialize participant
        participants[_nullifier] = Participant({
            payoutAddress: _payoutAddress,
            lastStreamTime: block.timestamp,
            totalStreamed: 0,
            hasReceivedPayout: false,
            isActive: true,
            joinedAt: block.timestamp
        });

        participantNullifiers.push(_nullifier);
        participantCount++;

        emit ParticipantJoined(_nullifier, _payoutAddress);
    }

    // ============ Contribution Tracking ============

    /**
     * @notice Track contribution (USDC already transferred by facilitator)
     * @dev This function ONLY tracks the payment. The facilitator must have already called
     *      USDC.transferWithAuthorization() to send tokens to this contract.
     *      When ALL participants have paid for this round, contract AUTOMATICALLY pays winner.
     * @param _nullifier Participant nullifier
     * @param _amount Amount that was transferred
     */
    function trackContribution(
        bytes32 _nullifier,
        uint256 _amount
    ) external nonReentrant {
        Participant storage participant = participants[_nullifier];

        require(isActive, "ROSCA not active");
        require(participant.isActive, "Participant not active");
        require(!roundContributions[currentRound][_nullifier], "Already contributed this round");

        // Calculate streamed amount since last update
        uint256 timeElapsed = block.timestamp - participant.lastStreamTime;
        uint256 streamedAmount = timeElapsed * streamRate;

        require(_amount <= streamedAmount, "Amount exceeds streaming limit");
        require(_amount == contributionAmount, "Must contribute exact amount");

        // Verify USDC was actually received (facilitator already sent it)
        uint256 contractBalance = IERC20(token).balanceOf(address(this));
        require(contractBalance >= _amount, "Insufficient contract balance");

        // Update participant state
        participant.lastStreamTime = block.timestamp;
        participant.totalStreamed += _amount;

        // Mark contribution for this round
        roundContributions[currentRound][_nullifier] = true;
        roundContributionCount[currentRound]++;

        totalContributed += _amount;

        emit ContributionTracked(_nullifier, _amount, block.timestamp);

        // Auto-trigger payout if ALL participants have paid this round
        _checkAndAutoPayWinner();
    }

    // ============ Automatic Payout Distribution ============

    /**
     * @notice Internal function to automatically pay winner when all participants have paid
     * @dev Called after each contribution is tracked
     */
    function _checkAndAutoPayWinner() internal {
        // Check if ALL participants have contributed this round
        if (roundContributionCount[currentRound] == totalParticipants) {
            // All payments received! Auto-pay the winner
            bytes32 winnerNullifier = participantNullifiers[currentRound % totalParticipants];

            // Prevent double payout
            require(!payoutClaimed[currentRound][winnerNullifier], "Already paid out");

            // Calculate payout amount (total pool for this round)
            uint256 payoutAmount = contributionAmount * totalParticipants;

            // Verify contract has sufficient balance
            uint256 contractBalance = IERC20(token).balanceOf(address(this));
            require(contractBalance >= payoutAmount, "Insufficient balance for payout");

            // Get winner's payout address
            address winner = participants[winnerNullifier].payoutAddress;
            require(winner != address(0), "Invalid winner address");

            // Mark as paid
            payoutClaimed[currentRound][winnerNullifier] = true;
            participants[winnerNullifier].hasReceivedPayout = true;

            // Transfer payout automatically
            IERC20(token).transfer(winner, payoutAmount);

            emit AutoPayoutTriggered(currentRound, winnerNullifier, roundContributionCount[currentRound]);
            emit PayoutDistributed(currentRound, winnerNullifier, winner, payoutAmount, true);

            // Move to next round
            currentRound++;
            lastPayoutTime = block.timestamp;

            // Check if ROSCA is complete
            if (currentRound >= totalParticipants) {
                isActive = false;
                emit ROSCACompleted(currentRound, block.timestamp);
            }
        }
    }

    // ============ View Functions ============

    function getROSCAInfo() external view returns (
        address _token,
        uint256 _contributionAmount,
        uint256 _streamRate,
        uint256 _cycleDuration,
        uint256 _totalParticipants,
        uint256 _currentRound,
        uint256 _totalContributed,
        bool _isActive,
        uint256 _participantCount
    ) {
        return (
            token,
            contributionAmount,
            streamRate,
            cycleDuration,
            totalParticipants,
            currentRound,
            totalContributed,
            isActive,
            participantCount
        );
    }

    function getParticipantInfo(bytes32 _nullifier)
        external
        view
        returns (Participant memory)
    {
        return participants[_nullifier];
    }

    function getCurrentRecipient() external view returns (bytes32) {
        if (currentRound >= totalParticipants) return bytes32(0);
        return participantNullifiers[currentRound % totalParticipants];
    }

    function getContractBalance() external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    function getNextPayoutTime() external view returns (uint256) {
        return lastPayoutTime + cycleDuration;
    }

    function isPayoutReady() external view returns (bool) {
        return block.timestamp >= lastPayoutTime + cycleDuration;
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
