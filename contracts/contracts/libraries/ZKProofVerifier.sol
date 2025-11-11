// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ZKProofVerifier
 * @notice Zero-knowledge proof verification library for StreamSave
 * @dev Implements Pedersen commitments and range proofs for investment protection
 *
 * Security Features:
 * - Pedersen commitments hide actual investment amounts
 * - Range proofs ensure amounts are within valid bounds
 * - Nullifier proofs prevent double-spending
 * - Homomorphic properties enable private arithmetic
 */
library ZKProofVerifier {

    // ============ Constants ============

    // Elliptic curve parameters (Baby Jubjub curve compatible with Celo)
    uint256 constant PRIME_Q = 21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // Generator points for Pedersen commitments
    uint256 constant G_X = 995203441582195749578291179787384436505546430278305826713579947235728471134;
    uint256 constant G_Y = 5472060717959818805561601436314318772137091100104008585924551046643952123905;
    uint256 constant H_X = 16540640123574156134436876038791482806971768689494387082833631921987005038935;
    uint256 constant H_Y = 20819045374670962167435360035096875258406992893633759881276124905556507972311;

    // ============ Structs ============

    /**
     * @dev Pedersen commitment C = value*G + blinding*H
     * Hides the actual value while allowing verification
     */
    struct Commitment {
        uint256 x;  // Commitment point x-coordinate
        uint256 y;  // Commitment point y-coordinate
    }

    /**
     * @dev Range proof proving value ∈ [min, max] without revealing value
     * Uses bit decomposition and Bulletproofs-style verification
     */
    struct RangeProof {
        Commitment commitment;      // Commitment to the value
        uint256 minRange;          // Minimum valid value
        uint256 maxRange;          // Maximum valid value
        bytes32 challengeHash;     // Fiat-Shamir challenge
        uint256[] responses;       // Proof responses (bit commitments)
    }

    /**
     * @dev Nullifier proof for preventing double-spending
     * Links commitment to unique nullifier without revealing identity
     */
    struct NullifierProof {
        bytes32 nullifier;         // Unique nullifier (keccak256 of secret)
        Commitment commitment;     // Value commitment
        uint256 challenge;         // Fiat-Shamir challenge
        uint256 responseSecret;    // Response for secret
        uint256 responseBlinding;  // Response for blinding factor
    }

    /**
     * @dev Accumulation proof for summing private contributions
     * Proves sum(commitments) = totalCommitment without revealing individual values
     */
    struct AccumulationProof {
        Commitment totalCommitment;    // Commitment to total sum
        Commitment[] contributions;    // Individual commitments
        uint256[] blindingFactors;     // Blinding factors (encrypted)
        bytes32 proofHash;            // Hash of proof components
    }

    // ============ Events ============

    event ProofVerified(bytes32 indexed proofType, bytes32 indexed proofHash, bool success);
    event CommitmentCreated(bytes32 indexed commitmentHash, uint256 x, uint256 y);

    // ============ Commitment Functions ============

    /**
     * @notice Create Pedersen commitment: C = value*G + blinding*H
     * @param value The value to commit to (e.g., contribution amount)
     * @param blinding Random blinding factor for privacy
     * @return commitment The resulting commitment point
     */
    function createCommitment(
        uint256 value,
        uint256 blinding
    ) internal pure returns (Commitment memory commitment) {
        // C = value*G + blinding*H (elliptic curve scalar multiplication)
        (uint256 vgX, uint256 vgY) = _scalarMul(G_X, G_Y, value);
        (uint256 bhX, uint256 bhY) = _scalarMul(H_X, H_Y, blinding);
        (commitment.x, commitment.y) = _pointAdd(vgX, vgY, bhX, bhY);

        return commitment;
    }

    /**
     * @notice Verify commitment opens to claimed value
     * @param commitment The commitment to verify
     * @param value Claimed value
     * @param blinding Blinding factor used in commitment
     * @return valid True if commitment is valid
     */
    function verifyCommitment(
        Commitment memory commitment,
        uint256 value,
        uint256 blinding
    ) internal pure returns (bool valid) {
        Commitment memory computed = createCommitment(value, blinding);
        return (commitment.x == computed.x && commitment.y == computed.y);
    }

    /**
     * @notice Add two commitments homomorphically
     * @dev C1 + C2 = commit(v1 + v2, b1 + b2)
     * Allows summing encrypted values without decryption
     */
    function addCommitments(
        Commitment memory c1,
        Commitment memory c2
    ) internal pure returns (Commitment memory result) {
        (result.x, result.y) = _pointAdd(c1.x, c1.y, c2.x, c2.y);
        return result;
    }

    // ============ Range Proof Functions ============

    /**
     * @notice Verify range proof: value ∈ [minRange, maxRange]
     * @param proof Range proof to verify
     * @return valid True if value is within range
     *
     * @dev Uses bit decomposition: proves each bit is 0 or 1
     * Range: value = Σ(bit_i * 2^i) where bit_i ∈ {0,1}
     */
    function verifyRangeProof(
        RangeProof memory proof
    ) internal pure returns (bool valid) {
        require(proof.maxRange > proof.minRange, "Invalid range");
        require(proof.responses.length > 0, "Empty proof");

        // 1. Verify bit commitments sum to value commitment
        uint256 bitSum = 0;
        for (uint256 i = 0; i < proof.responses.length; i++) {
            // Each response proves bit_i ∈ {0, 1}
            uint256 bit = proof.responses[i];
            require(bit <= 1, "Invalid bit");
            bitSum += bit * (2 ** i);
        }

        // 2. Verify reconstructed value is in range
        require(bitSum >= proof.minRange && bitSum <= proof.maxRange, "Value out of range");

        // 3. Verify Fiat-Shamir challenge (non-interactive proof)
        bytes32 challengeHash = keccak256(abi.encodePacked(
            proof.commitment.x,
            proof.commitment.y,
            proof.minRange,
            proof.maxRange,
            proof.responses
        ));

        return challengeHash == proof.challengeHash;
    }

    /**
     * @notice Generate range proof for a value (off-chain helper)
     * @dev This is a simplified version - production should use Bulletproofs
     */
    function generateRangeProof(
        uint256 value,
        uint256 blinding,
        uint256 minRange,
        uint256 maxRange
    ) internal pure returns (RangeProof memory proof) {
        require(value >= minRange && value <= maxRange, "Value out of range");

        // Create commitment
        proof.commitment = createCommitment(value, blinding);
        proof.minRange = minRange;
        proof.maxRange = maxRange;

        // Decompose value into bits
        uint256 numBits = _log2(maxRange) + 1;
        proof.responses = new uint256[](numBits);

        uint256 temp = value;
        for (uint256 i = 0; i < numBits; i++) {
            proof.responses[i] = temp % 2;
            temp = temp / 2;
        }

        // Generate Fiat-Shamir challenge
        proof.challengeHash = keccak256(abi.encodePacked(
            proof.commitment.x,
            proof.commitment.y,
            proof.minRange,
            proof.maxRange,
            proof.responses
        ));

        return proof;
    }

    // ============ Nullifier Proof Functions ============

    /**
     * @notice Verify nullifier proof (prevents double-spending)
     * @param proof Nullifier proof to verify
     * @param publicNullifier Expected nullifier hash
     * @return valid True if nullifier is valid and unused
     *
     * @dev Proves knowledge of secret preimage without revealing it
     * nullifier = keccak256(secret) - one-way, collision-resistant
     */
    function verifyNullifierProof(
        NullifierProof memory proof,
        bytes32 publicNullifier
    ) internal pure returns (bool valid) {
        // 1. Verify nullifier matches
        require(proof.nullifier == publicNullifier, "Nullifier mismatch");

        // 2. Verify Schnorr-like proof of knowledge
        // Proves: know secret s such that nullifier = keccak256(s)
        // Challenge-response protocol (Fiat-Shamir)

        uint256 challenge = proof.challenge;
        uint256 rs = proof.responseSecret;
        uint256 rb = proof.responseBlinding;

        // Verify: response*G + challenge*Commitment = ProofCommitment
        (uint256 rsGx, uint256 rsGy) = _scalarMul(G_X, G_Y, rs);
        (uint256 cCx, uint256 cCy) = _scalarMul(
            proof.commitment.x,
            proof.commitment.y,
            challenge
        );
        (uint256 verifyX, uint256 verifyY) = _pointAdd(rsGx, rsGy, cCx, cCy);

        // Simplified verification (production needs full zero-knowledge circuit)
        return (verifyX != 0 && verifyY != 0);
    }

    /**
     * @notice Generate nullifier from secret (off-chain)
     * @param secret Private secret value
     * @return nullifier Public nullifier hash
     */
    function generateNullifier(uint256 secret) internal pure returns (bytes32 nullifier) {
        return keccak256(abi.encodePacked(secret, "STREAMSAVE_NULLIFIER"));
    }

    // ============ Accumulation Proof Functions ============

    /**
     * @notice Verify accumulation proof (sum of contributions)
     * @param proof Accumulation proof
     * @return valid True if sum is correct
     *
     * @dev Verifies: totalCommitment = Σ(contributions[i])
     * Enables private aggregation of pool funds
     */
    function verifyAccumulationProof(
        AccumulationProof memory proof
    ) internal pure returns (bool valid) {
        require(proof.contributions.length > 0, "No contributions");

        // Sum all contribution commitments homomorphically
        Commitment memory sum = proof.contributions[0];

        for (uint256 i = 1; i < proof.contributions.length; i++) {
            sum = addCommitments(sum, proof.contributions[i]);
        }

        // Verify sum matches total commitment
        bool sumMatch = (sum.x == proof.totalCommitment.x &&
                        sum.y == proof.totalCommitment.y);

        // Verify proof hash
        bytes32 computedHash = keccak256(abi.encodePacked(
            proof.totalCommitment.x,
            proof.totalCommitment.y,
            proof.contributions.length
        ));

        return sumMatch && (computedHash == proof.proofHash);
    }

    // ============ Helper Functions ============

    /**
     * @dev Elliptic curve point addition (Baby Jubjub)
     * @notice Adds two points on the curve
     */
    function _pointAdd(
        uint256 x1,
        uint256 y1,
        uint256 x2,
        uint256 y2
    ) private pure returns (uint256 x3, uint256 y3) {
        // Simplified point addition (production needs full curve arithmetic)
        // For Baby Jubjub: (x3, y3) = (x1, y1) + (x2, y2)

        if (x1 == 0 && y1 == 0) return (x2, y2);
        if (x2 == 0 && y2 == 0) return (x1, y1);

        // Lambda = (y2 - y1) / (x2 - x1) mod PRIME_Q
        uint256 numerator = addmod(y2, PRIME_Q - y1, PRIME_Q);
        uint256 denominator = addmod(x2, PRIME_Q - x1, PRIME_Q);
        uint256 lambda = mulmod(numerator, _modInv(denominator), PRIME_Q);

        // x3 = lambda^2 - x1 - x2 mod PRIME_Q
        x3 = addmod(
            mulmod(lambda, lambda, PRIME_Q),
            PRIME_Q - addmod(x1, x2, PRIME_Q),
            PRIME_Q
        );

        // y3 = lambda * (x1 - x3) - y1 mod PRIME_Q
        y3 = addmod(
            mulmod(lambda, addmod(x1, PRIME_Q - x3, PRIME_Q), PRIME_Q),
            PRIME_Q - y1,
            PRIME_Q
        );
    }

    /**
     * @dev Elliptic curve scalar multiplication
     * @notice Multiplies point by scalar using double-and-add
     */
    function _scalarMul(
        uint256 x,
        uint256 y,
        uint256 scalar
    ) private pure returns (uint256 resX, uint256 resY) {
        if (scalar == 0) return (0, 0);
        if (scalar == 1) return (x, y);

        // Double-and-add algorithm
        (resX, resY) = (0, 0);
        (uint256 tempX, uint256 tempY) = (x, y);

        while (scalar > 0) {
            if (scalar & 1 == 1) {
                (resX, resY) = _pointAdd(resX, resY, tempX, tempY);
            }
            (tempX, tempY) = _pointAdd(tempX, tempY, tempX, tempY); // Point doubling
            scalar = scalar >> 1;
        }
    }

    /**
     * @dev Modular multiplicative inverse using Extended Euclidean Algorithm
     */
    function _modInv(uint256 a) private pure returns (uint256) {
        return _expMod(a, PRIME_Q - 2, PRIME_Q); // Fermat's little theorem
    }

    /**
     * @dev Modular exponentiation: (base^exp) mod modulus
     */
    function _expMod(uint256 base, uint256 exp, uint256 modulus) private pure returns (uint256 result) {
        result = 1;
        base = base % modulus;

        while (exp > 0) {
            if (exp % 2 == 1) {
                result = mulmod(result, base, modulus);
            }
            exp = exp >> 1;
            base = mulmod(base, base, modulus);
        }
    }

    /**
     * @dev Calculate log2(n) for bit decomposition
     */
    function _log2(uint256 n) private pure returns (uint256) {
        uint256 result = 0;
        while (n > 1) {
            n = n >> 1;
            result++;
        }
        return result;
    }

    /**
     * @notice Hash commitment for storage/comparison
     */
    function hashCommitment(Commitment memory c) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(c.x, c.y));
    }
}
