import { Address } from 'viem';

// StreamSaveFactoryV2 deployed on Celo Mainnet (Calendar-based rounds)
export const FACTORY_V2_ADDRESS: Address = '0x157f9f000BCC23Fd497E76C38EA340DcC97a3FEf';

// StreamSaveFactoryV2.sol ABI
export const StreamSaveFactoryV2ABI = [
  // Events
  {
    type: 'event',
    name: 'GroupCreated',
    inputs: [
      { name: 'groupAddress', type: 'address', indexed: true, internalType: 'address' },
      { name: 'creator', type: 'address', indexed: true, internalType: 'address' },
      { name: 'totalParticipants', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'contributionAmount', type: 'uint256', indexed: false, internalType: 'uint256' },
      { name: 'roundTimestamps', type: 'uint256[]', indexed: false, internalType: 'uint256[]' },
      { name: 'timestamp', type: 'uint256', indexed: false, internalType: 'uint256' }
    ]
  },

  // State Variables
  {
    type: 'function',
    name: 'usdcToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address', internalType: 'address' }]
  },

  // Write Functions
  {
    type: 'function',
    name: 'createGroup',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'merkleRoot', type: 'bytes32', internalType: 'bytes32' },
      { name: 'contributionAmount', type: 'uint256', internalType: 'uint256' },
      { name: 'roundTimestamps', type: 'uint256[]', internalType: 'uint256[]' },
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
