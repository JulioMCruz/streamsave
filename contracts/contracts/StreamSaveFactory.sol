// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./StreamSave.sol";

/**
 * @title StreamSaveFactory
 * @notice Factory contract for creating StreamSave ROSCA groups
 * @dev Allows users to create new ROSCA groups through the UI without CLI deployment
 *
 * Benefits:
 * - One-time factory deployment
 * - Users create groups via web UI
 * - All groups discoverable on-chain
 * - Automatic indexing and tracking
 */
contract StreamSaveFactory {

    // ============ Events ============

    event GroupCreated(
        address indexed groupAddress,
        address indexed creator,
        uint256 totalParticipants,
        uint256 contributionAmount,
        uint256 cycleDuration,
        uint256 timestamp
    );

    // ============ State ============

    address public immutable usdcToken;  // USDC token address on Celo
    address[] public allGroups;          // All created groups
    mapping(address => address[]) public creatorGroups;  // Groups by creator
    mapping(address => bool) public isGroup;             // Quick lookup

    // ============ Constructor ============

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = _usdcToken;
    }

    // ============ Functions ============

    /**
     * @notice Create a new StreamSave ROSCA group
     * @param merkleRoot Merkle root of participant nullifiers (privacy-preserving)
     * @param contributionAmount Required contribution per cycle (in USDC, 6 decimals)
     * @param cycleDuration Duration of each payout cycle in seconds
     * @param totalParticipants Number of participants in the group (3-20)
     * @return groupAddress Address of the newly created group contract
     */
    function createGroup(
        bytes32 merkleRoot,
        uint256 contributionAmount,
        uint256 cycleDuration,
        uint256 totalParticipants
    ) external returns (address groupAddress) {
        // Validate parameters
        require(merkleRoot != bytes32(0), "Invalid merkle root");
        require(contributionAmount > 0, "Invalid contribution amount");
        require(cycleDuration >= 2 minutes, "Cycle too short");
        require(totalParticipants >= 3 && totalParticipants <= 20, "Invalid participant count");

        // Deploy new StreamSaveROSCA contract
        StreamSaveROSCA newGroup = new StreamSaveROSCA(
            usdcToken,
            merkleRoot,
            contributionAmount,
            contributionAmount, // streamRate = contributionAmount for MVP
            cycleDuration,
            totalParticipants
        );

        groupAddress = address(newGroup);

        // Track the group
        allGroups.push(groupAddress);
        creatorGroups[msg.sender].push(groupAddress);
        isGroup[groupAddress] = true;

        emit GroupCreated(
            groupAddress,
            msg.sender,
            totalParticipants,
            contributionAmount,
            cycleDuration,
            block.timestamp
        );

        return groupAddress;
    }

    /**
     * @notice Get all created groups
     * @return Array of all group addresses
     */
    function getAllGroups() external view returns (address[] memory) {
        return allGroups;
    }

    /**
     * @notice Get groups created by a specific address
     * @param creator Address of the creator
     * @return Array of group addresses created by the creator
     */
    function getCreatorGroups(address creator) external view returns (address[] memory) {
        return creatorGroups[creator];
    }

    /**
     * @notice Get total number of groups created
     * @return Total group count
     */
    function getGroupCount() external view returns (uint256) {
        return allGroups.length;
    }

    /**
     * @notice Check if an address is a valid group created by this factory
     * @param group Address to check
     * @return True if it's a valid group
     */
    function isValidGroup(address group) external view returns (bool) {
        return isGroup[group];
    }
}
