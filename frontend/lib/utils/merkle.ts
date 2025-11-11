import { keccak256, toHex, encodePacked } from 'viem';

/**
 * Generate nullifier from wallet address
 */
export function generateNullifierFromAddress(address: string): `0x${string}` {
  return keccak256(encodePacked(['address', 'string'], [address as `0x${string}`, 'streamsave-participant']));
}

/**
 * Simple merkle tree implementation for participant verification
 * In production, use a proper merkle tree library like merkletreejs
 */
export class SimpleMerkleTree {
  private leaves: `0x${string}`[];
  private tree: `0x${string}`[][];

  constructor(addresses: string[]) {
    // Generate nullifiers from addresses
    this.leaves = addresses.map(addr => generateNullifierFromAddress(addr));
    this.tree = this.buildTree(this.leaves);
  }

  private buildTree(leaves: `0x${string}`[]): `0x${string}`[][] {
    if (leaves.length === 0) {
      throw new Error('Cannot build tree with no leaves');
    }

    const tree: `0x${string}`[][] = [leaves];
    let currentLevel = leaves;

    while (currentLevel.length > 1) {
      const nextLevel: `0x${string}`[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          // Hash pair
          const combined = currentLevel[i] < currentLevel[i + 1]
            ? `${currentLevel[i]}${currentLevel[i + 1].slice(2)}`
            : `${currentLevel[i + 1]}${currentLevel[i].slice(2)}`;
          nextLevel.push(keccak256(combined as `0x${string}`));
        } else {
          // Odd number of nodes, promote the last one
          nextLevel.push(currentLevel[i]);
        }
      }

      tree.push(nextLevel);
      currentLevel = nextLevel;
    }

    return tree;
  }

  getRoot(): `0x${string}` {
    return this.tree[this.tree.length - 1][0];
  }

  getLeaves(): `0x${string}`[] {
    return this.leaves;
  }

  /**
   * Get merkle proof for a specific address
   */
  getProof(address: string): `0x${string}`[] {
    const nullifier = generateNullifierFromAddress(address);
    const leafIndex = this.leaves.findIndex(leaf => leaf === nullifier);

    if (leafIndex === -1) {
      throw new Error('Address not found in merkle tree');
    }

    const proof: `0x${string}`[] = [];
    let currentIndex = leafIndex;

    for (let level = 0; level < this.tree.length - 1; level++) {
      const currentLevelNodes = this.tree[level];
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      if (siblingIndex < currentLevelNodes.length) {
        proof.push(currentLevelNodes[siblingIndex]);
      }

      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }

  /**
   * Export tree data for storage
   */
  exportTreeData() {
    return {
      leaves: this.leaves,
      root: this.getRoot(),
      addresses: this.leaves.map((_, idx) => ({
        index: idx,
        nullifier: this.leaves[idx]
      }))
    };
  }
}
