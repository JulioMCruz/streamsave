// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC3009
 * @notice Interface for EIP-3009: Transfer With Authorization
 * @dev Extends ERC20 with gasless transfer capabilities using off-chain signatures
 *
 * Reference: https://eips.ethereum.org/EIPS/eip-3009
 * USDC on Celo Mainnet: 0xcebA9300f2b948710d2653dD7B07f33A8B32118C
 */
interface IERC3009 {
    /**
     * @notice Execute a transfer with a signed authorization
     * @param from Payer's address (Authorizer)
     * @param to Payee's address
     * @param value Amount to be transferred
     * @param validAfter The time after which this is valid (unix timestamp)
     * @param validBefore The time before which this is valid (unix timestamp)
     * @param nonce Unique nonce
     * @param v Signature v component
     * @param r Signature r component
     * @param s Signature s component
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Execute a transfer with a signed authorization (alternative signature format)
     * @param from Payer's address (Authorizer)
     * @param to Payee's address
     * @param value Amount to be transferred
     * @param validAfter The time after which this is valid (unix timestamp)
     * @param validBefore The time before which this is valid (unix timestamp)
     * @param nonce Unique nonce
     * @param signature Signature byte array (65 bytes)
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;

    /**
     * @notice Receive a transfer with a signed authorization from msg.sender
     * @param from Payer's address (Authorizer)
     * @param to Payee's address (must be msg.sender)
     * @param value Amount to be transferred
     * @param validAfter The time after which this is valid (unix timestamp)
     * @param validBefore The time before which this is valid (unix timestamp)
     * @param nonce Unique nonce
     * @param v Signature v component
     * @param r Signature r component
     * @param s Signature s component
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Attempt to cancel an authorization
     * @param authorizer Authorizer's address
     * @param nonce Nonce of the authorization
     * @param v Signature v component
     * @param r Signature r component
     * @param s Signature s component
     */
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /**
     * @notice Returns the state of an authorization
     * @param authorizer Authorizer's address
     * @param nonce Nonce of the authorization
     * @return True if the nonce has been used
     */
    function authorizationState(address authorizer, bytes32 nonce) external view returns (bool);

    /**
     * @dev Emitted when an authorization is used
     */
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);

    /**
     * @dev Emitted when an authorization is canceled
     */
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);
}
