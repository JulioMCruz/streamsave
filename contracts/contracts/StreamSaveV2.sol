// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StreamSaveROSCAV2
 * @notice ROSCA with calendar-based round scheduling (specific dates for each round)
 * @dev Each round has a specific timestamp instead of fixed interval duration
 *
 * Key Changes from V1:
 * - roundTimestamps[] array instead of cycleDuration
 * - Each round has its own scheduled date/time
 * - More flexible for real-world ROSCA groups (e.g., 1st and 15th of month)
 */
contract StreamSaveROSCAV2 is ReentrancyGuard {

    // ============ Structs ============

    struct Participant {
        address payoutAddress;
        uint256 totalContributed;
        bool hasReceivedPayout;
        bool isActive;
        uint256 joinedAt;
    }

    // ============ Immutable State ============

    address public immutable token;
    bytes32 public immutable merkleRoot;
    uint256 public immutable contributionAmount;
    uint256 public immutable totalParticipants;
    uint256 public immutable createdAt;

    // ============ Mutable State ============

    uint256 public currentRound;
    uint256 public totalContributed;
    bool public isActive;
    uint256 public participantCount;

    // Round timestamps (one per participant)
    uint256[] public roundTimestamps;

    // nullifier => Participant
    mapping(bytes32 => Participant) public participants;

    // round => nullifier => claimed
    mapping(uint256 => mapping(bytes32 => bool)) public payoutClaimed;

    // round => nullifier => contributed
    mapping(uint256 => mapping(bytes32 => bool)) public roundContributions;

    // round => contribution count
    mapping(uint256 => uint256) public roundContributionCount;

    // Array of nullifiers
    bytes32[] public participantNullifiers;

    // ============ Events ============

    event ParticipantJoined(bytes32 indexed nullifier, address indexed payoutAddress);
    event ContributionTracked(bytes32 indexed nullifier, uint256 amount, uint256 round);
    event PayoutDistributed(uint256 indexed round, bytes32 indexed recipientNullifier, address indexed recipient, uint256 amount);
    event ROSCACompleted(uint256 totalRounds, uint256 completedAt);
    event RoundAdvanced(uint256 newRound, uint256 nextRoundTime);

    // ============ Errors ============

    error InvalidMerkleRoot();
    error InvalidContributionAmount();
    error InvalidParticipantCount();
    error InvalidRoundTimestamps();
    error RoundNotStarted();
    error AlreadyContributed();
    error InvalidProof();
    error InsufficientBalance();
    error PayoutAlreadyClaimed();
    error NotTimeForPayout();
    error ROSCANotActive();

    // ============ Constructor ============

    /**
     * @param _token USDC token address
     * @param _merkleRoot Merkle root of participant nullifiers
     * @param _contributionAmount Amount per round (USDC with 6 decimals)
     * @param _roundTimestamps Array of unix timestamps for each round
     * @param _totalParticipants Number of participants (must match roundTimestamps.length)
     */
    constructor(
        address _token,
        bytes32 _merkleRoot,
        uint256 _contributionAmount,
        uint256[] memory _roundTimestamps,
        uint256 _totalParticipants
    ) {
        if (_merkleRoot == bytes32(0)) revert InvalidMerkleRoot();
        if (_contributionAmount == 0) revert InvalidContributionAmount();
        if (_totalParticipants < 3 || _totalParticipants > 20) revert InvalidParticipantCount();
        if (_roundTimestamps.length != _totalParticipants) revert InvalidRoundTimestamps();

        // Validate round timestamps are in ascending order and in the future
        for (uint256 i = 0; i < _roundTimestamps.length; i++) {
            if (_roundTimestamps[i] <= block.timestamp) revert InvalidRoundTimestamps();
            if (i > 0 && _roundTimestamps[i] <= _roundTimestamps[i - 1]) revert InvalidRoundTimestamps();
        }

        token = _token;
        merkleRoot = _merkleRoot;
        contributionAmount = _contributionAmount;
        totalParticipants = _totalParticipants;
        roundTimestamps = _roundTimestamps;
        createdAt = block.timestamp;
        isActive = true;
        currentRound = 0;
    }

    // ============ Core Functions ============

    /**
     * @notice Track contribution for current round
     * @param nullifier Privacy-preserving participant identifier
     * @param proof Merkle proof for nullifier
     */
    function trackContribution(
        bytes32 nullifier,
        bytes32[] calldata proof
    ) external nonReentrant {
        if (!isActive) revert ROSCANotActive();
        if (currentRound >= totalParticipants) revert ROSCANotActive();

        // Check if current round has started
        if (block.timestamp < roundTimestamps[currentRound]) revert RoundNotStarted();

        // Verify merkle proof
        if (!_verifyProof(proof, nullifier)) revert InvalidProof();

        // Check not already contributed this round
        if (roundContributions[currentRound][nullifier]) revert AlreadyContributed();

        // Check contract received the USDC (transferred by x402 facilitator)
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance < totalContributed + contributionAmount) revert InsufficientBalance();

        // Register participant if first time
        if (!participants[nullifier].isActive) {
            participants[nullifier] = Participant({
                payoutAddress: msg.sender,
                totalContributed: 0,
                hasReceivedPayout: false,
                isActive: true,
                joinedAt: block.timestamp
            });
            participantNullifiers.push(nullifier);
            participantCount++;
            emit ParticipantJoined(nullifier, msg.sender);
        }

        // Track contribution
        roundContributions[currentRound][nullifier] = true;
        roundContributionCount[currentRound]++;
        participants[nullifier].totalContributed += contributionAmount;
        totalContributed += contributionAmount;

        emit ContributionTracked(nullifier, contributionAmount, currentRound);

        // Auto-advance round and payout if all contributed
        if (roundContributionCount[currentRound] == totalParticipants) {
            _distributePayout();
        }
    }

    /**
     * @notice Claim payout for completed round (if auto-payout didn't trigger)
     * @param round Round number to claim
     * @param nullifier Participant nullifier
     * @param proof Merkle proof
     */
    function claimPayout(
        uint256 round,
        bytes32 nullifier,
        bytes32[] calldata proof
    ) external nonReentrant {
        if (round >= currentRound) revert NotTimeForPayout();
        if (payoutClaimed[round][nullifier]) revert PayoutAlreadyClaimed();
        if (!_verifyProof(proof, nullifier)) revert InvalidProof();

        // Check it's time for this round's payout
        if (block.timestamp < roundTimestamps[round]) revert NotTimeForPayout();

        // Verify all participants contributed for this round
        if (roundContributionCount[round] < totalParticipants) revert NotTimeForPayout();

        // Winner is determined by round number (round 0 → nullifier[0], etc.)
        bytes32 winnerNullifier = participantNullifiers[round];
        if (nullifier != winnerNullifier) revert InvalidProof();

        payoutClaimed[round][nullifier] = true;
        participants[nullifier].hasReceivedPayout = true;

        uint256 payoutAmount = contributionAmount * totalParticipants;
        require(IERC20(token).transfer(participants[nullifier].payoutAddress, payoutAmount), "Transfer failed");

        emit PayoutDistributed(round, nullifier, participants[nullifier].payoutAddress, payoutAmount);
    }

    /**
     * @notice Advance to next round (anyone can call after round completes)
     */
    function advanceRound() external {
        if (currentRound >= totalParticipants) revert ROSCANotActive();
        if (roundContributionCount[currentRound] < totalParticipants) revert NotTimeForPayout();

        currentRound++;

        if (currentRound >= totalParticipants) {
            isActive = false;
            emit ROSCACompleted(totalParticipants, block.timestamp);
        } else {
            emit RoundAdvanced(currentRound, roundTimestamps[currentRound]);
        }
    }

    // ============ Internal Functions ============

    function _distributePayout() internal {
        bytes32 winnerNullifier = participantNullifiers[currentRound];
        payoutClaimed[currentRound][winnerNullifier] = true;
        participants[winnerNullifier].hasReceivedPayout = true;

        uint256 payoutAmount = contributionAmount * totalParticipants;
        require(IERC20(token).transfer(participants[winnerNullifier].payoutAddress, payoutAmount), "Transfer failed");

        emit PayoutDistributed(currentRound, winnerNullifier, participants[winnerNullifier].payoutAddress, payoutAmount);

        // Advance to next round
        currentRound++;
        if (currentRound >= totalParticipants) {
            isActive = false;
            emit ROSCACompleted(totalParticipants, block.timestamp);
        } else {
            emit RoundAdvanced(currentRound, roundTimestamps[currentRound]);
        }
    }

    function _verifyProof(bytes32[] memory proof, bytes32 leaf) internal view returns (bool) {
        bytes32 computedHash = leaf;

        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash < proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }

        return computedHash == merkleRoot;
    }

    // ============ View Functions ============

    function getRoundTimestamp(uint256 round) external view returns (uint256) {
        require(round < roundTimestamps.length, "Invalid round");
        return roundTimestamps[round];
    }

    function getAllRoundTimestamps() external view returns (uint256[] memory) {
        return roundTimestamps;
    }

    function isRoundActive(uint256 round) external view returns (bool) {
        if (round >= roundTimestamps.length) return false;
        return block.timestamp >= roundTimestamps[round] && round <= currentRound;
    }

    function getParticipant(bytes32 nullifier) external view returns (Participant memory) {
        return participants[nullifier];
    }

    function getContractBalance() external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
}
