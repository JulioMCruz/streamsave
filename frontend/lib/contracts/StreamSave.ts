import { Address } from 'viem';

// USDC on Celo mainnet
export const CELO_USDC_ADDRESS: Address = '0xcebA9300f2b948710d2653dD7B07f33A8B32118C';

// Deployed StreamSave group addresses (add after deployment)
export const DEPLOYED_GROUPS: Array<{ address: Address; name: string }> = [
  // Example: { address: '0x...', name: 'Weekly Savings Circle' }
];

// StreamSave.sol ABI (generated from contract)
export const StreamSaveABI = [
  // Constructor
  {
    type: 'constructor',
    inputs: [
      { name: '_token', type: 'address', internalType: 'address' },
      { name: '_merkleRoot', type: 'bytes32', internalType: 'bytes32' },
      { name: '_contributionAmount', type: 'uint256', internalType: 'uint256' },
      { name: '_streamRate', type: 'uint256', internalType: 'uint256' },
      { name: '_cycleDuration', type: 'uint256', internalType: 'uint256' },
      { name: '_totalParticipants', type: 'uint256', internalType: 'uint256' }
    ],
    stateMutability: 'nonpayable'
  },

  // State Variables (View Functions)
  {
    type: 'function',
    name: 'token',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }]
  },
  {
    type: 'function',
    name: 'merkleRoot',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'contributionAmount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'streamRate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'cycleDuration',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'totalParticipants',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'createdAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'currentRound',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'lastPayoutTime',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'totalContributed',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'isActive',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }]
  },
  {
    type: 'function',
    name: 'participantCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },

  // Mappings (View Functions)
  {
    type: 'function',
    name: 'participants',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }],
    outputs: [
      { name: 'payoutAddress', type: 'address', internalType: 'address' },
      { name: 'joinedAt', type: 'uint256', internalType: 'uint256' },
      { name: 'hasReceivedPayout', type: 'bool', internalType: 'bool' }
    ]
  },
  {
    type: 'function',
    name: 'participantNullifiers',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32', internalType: 'bytes32' }]
  },
  {
    type: 'function',
    name: 'roundContributions',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'uint256', internalType: 'uint256' },
      { name: '', type: 'bytes32', internalType: 'bytes32' }
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }]
  },
  {
    type: 'function',
    name: 'roundContributionCount',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },

  // Write Functions
  {
    type: 'function',
    name: 'joinROSCA',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_nullifier', type: 'bytes32', internalType: 'bytes32' },
      { name: '_payoutAddress', type: 'address', internalType: 'address' },
      { name: '_merkleProof', type: 'bytes32[]', internalType: 'bytes32[]' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'trackContribution',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_nullifier', type: 'bytes32', internalType: 'bytes32' },
      { name: '_amount', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: []
  },

  // Events
  {
    type: 'event',
    name: 'ParticipantJoined',
    inputs: [
      { name: 'nullifier', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'payoutAddress', type: 'address', indexed: true, internalType: 'address' }
    ]
  },
  {
    type: 'event',
    name: 'ContributionTracked',
    inputs: [
      { name: 'nullifier', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' }
    ]
  },
  {
    type: 'event',
    name: 'AutoPayoutTriggered',
    inputs: [
      { name: 'round', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'recipientNullifier', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'contributionCount', type: 'uint256', indexed: false, internalType: 'uint256' }
    ]
  },
  {
    type: 'event',
    name: 'PayoutDistributed',
    inputs: [
      { name: 'round', type: 'uint256', indexed: true, internalType: 'uint256' },
      { name: 'recipientNullifier', type: 'bytes32', indexed: true, internalType: 'bytes32' },
      { name: 'recipient', type: 'address', indexed: true, internalType: 'address' },
      { name: 'amount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'isAutomatic', type: 'bool', indexed: false, internalType: 'bool' }
    ]
  },
  {
    type: 'event',
    name: 'ROSCACompleted',
    inputs: [
      { name: 'totalRounds', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'completedAt', type: 'uint256', indexed: false, internalType: 'uint256' }
    ]
  },

  // Errors
  {
    type: 'error',
    name: 'ROSCANotActive',
    inputs: []
  },
  {
    type: 'error',
    name: 'NullifierAlreadyUsed',
    inputs: []
  },
  {
    type: 'error',
    name: 'InvalidMerkleProof',
    inputs: []
  },
  {
    type: 'error',
    name: 'ROSCAFull',
    inputs: []
  },
  {
    type: 'error',
    name: 'InsufficientBalance',
    inputs: []
  },
  {
    type: 'error',
    name: 'InvalidContributionAmount',
    inputs: []
  },
  {
    type: 'error',
    name: 'AlreadyContributedThisRound',
    inputs: []
  },
  {
    type: 'error',
    name: 'StreamingLimitExceeded',
    inputs: []
  }
] as const;
