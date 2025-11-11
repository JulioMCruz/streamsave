// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./StreamSaveV2.sol";

/**
 * @title StreamSaveFactoryV2
 * @notice Factory for creating calendar-based ROSCA groups
 * @dev Creates StreamSaveROSCAV2 instances with specific round dates
 */
contract StreamSaveFactoryV2 {

    // ============ Events ============

    event GroupCreated(
        address indexed groupAddress,
        address indexed creator,
        uint256 totalParticipants,
        uint256 contributionAmount,
        uint256[] roundTimestamps,
        uint256 timestamp
    );

    // ============ State ============

    address public immutable usdcToken;
    address[] public allGroups;
    mapping(address => address[]) public creatorGroups;
    mapping(address => bool) public isGroup;

    // ============ Constructor ============

    constructor(address _usdcToken) {
        require(_usdcToken != address(0), "Invalid USDC address");
        usdcToken = _usdcToken;
    }

    // ============ Functions ============

    /**
     * @notice Create a new calendar-based StreamSave ROSCA group
     * @param merkleRoot Merkle root of participant nullifiers
     * @param contributionAmount Required contribution per round (USDC, 6 decimals)
     * @param roundTimestamps Array of unix timestamps for each round
     * @param totalParticipants Number of participants (must match roundTimestamps.length)
     * @return groupAddress Address of the newly created group
     */
    function createGroup(
        bytes32 merkleRoot,
        uint256 contributionAmount,
        uint256[] calldata roundTimestamps,
        uint256 totalParticipants
    ) external returns (address groupAddress) {
        // Validate parameters
        require(merkleRoot != bytes32(0), "Invalid merkle root");
        require(contributionAmount > 0, "Invalid contribution amount");
        require(totalParticipants >= 3 && totalParticipants <= 20, "Invalid participant count");
        require(roundTimestamps.length == totalParticipants, "Timestamps must match participant count");

        // Validate timestamps
        for (uint256 i = 0; i < roundTimestamps.length; i++) {
            require(roundTimestamps[i] > block.timestamp, "Round must be in future");
            if (i > 0) {
                require(roundTimestamps[i] > roundTimestamps[i - 1], "Rounds must be in ascending order");
            }
        }

        // Deploy new StreamSaveROSCAV2 contract
        StreamSaveROSCAV2 newGroup = new StreamSaveROSCAV2(
            usdcToken,
            merkleRoot,
            contributionAmount,
            roundTimestamps,
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
            roundTimestamps,
            block.timestamp
        );

        return groupAddress;
    }

    /**
     * @notice Get all created groups
     */
    function getAllGroups() external view returns (address[] memory) {
        return allGroups;
    }

    /**
     * @notice Get groups created by a specific address
     */
    function getCreatorGroups(address creator) external view returns (address[] memory) {
        return creatorGroups[creator];
    }

    /**
     * @notice Get total number of groups created
     */
    function getGroupCount() external view returns (uint256) {
        return allGroups.length;
    }

    /**
     * @notice Check if an address is a valid group
     */
    function isValidGroup(address group) external view returns (bool) {
        return isGroup[group];
    }
}
