import { Address } from 'viem';

// StreamSaveFactory deployed on Celo Mainnet
export const FACTORY_ADDRESS: Address = '0x4bcCE8AeB801D27FE36Bb442F8d7216cC1304573';

// StreamSaveFactory.sol ABI
export const StreamSaveFactoryABI = [
  // Events
  {
    type: 'event',
    name: 'GroupCreated',
    inputs: [
      { name: 'groupAddress', type: 'address', indexed: true, internalType: 'address' },
      { name: 'creator', type: 'address', indexed: true, internalType: 'address' },
      { name: 'totalParticipants', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'contributionAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'cycleDuration', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' }
    ]
  },

  // State Variables (View Functions)
  {
    type: 'function',
    name: 'usdcToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }]
  },
  {
    type: 'function',
    name: 'allGroups',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    outputs: [{ name: '', type: 'address', internalType: 'address' }]
  },
  {
    type: 'function',
    name: 'creatorGroups',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'address', internalType: 'address' },
      { name: '', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: '', type: 'address', internalType: 'address' }]
  },
  {
    type: 'function',
    name: 'isGroup',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }]
  },

  // Write Functions
  {
    type: 'function',
    name: 'createGroup',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'merkleRoot', type: 'bytes32', internalType: 'bytes32' },
      { name: 'contributionAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'cycleDuration', type: 'uint256', internalType: 'uint256' },
      { name: 'totalParticipants', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [{ name: 'groupAddress', type: 'address', internalType: 'address' }]
  },

  // View Functions
  {
    type: 'function',
    name: 'getAllGroups',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]', internalType: 'address[]' }]
  },
  {
    type: 'function',
    name: 'getCreatorGroups',
    stateMutability: 'view',
    inputs: [{ name: 'creator', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'address[]', internalType: 'address[]' }]
  },
  {
    type: 'function',
    name: 'getGroupCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }]
  },
  {
    type: 'function',
    name: 'isValidGroup',
    stateMutability: 'view',
    inputs: [{ name: 'group', type: 'address', internalType: 'address' }],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }]
  }
] as const;
