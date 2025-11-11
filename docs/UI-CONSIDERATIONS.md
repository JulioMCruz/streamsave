# StreamSave UI Considerations

## Technology Stack

### Frontend Framework
- **Next.js** with App Router
- **Tailwind CSS** for styling
- **shadcn/ui** components
- **React 18+** with Server Components

### Web3 Integration
- **Viem** - Modern TypeScript library for Ethereum
- **Wagmi** - React hooks for wallet connection and contract interaction
- **RainbowKit** or **ConnectKit** - Wallet connection wrapper in header

### State Management
- **React Query** (via Wagmi) for contract state
- **Zustand** or **Context API** for app state
- **Local Storage** for user preferences

## Application Structure

### Public Routes

#### Landing/Marketing Page (`/`)
**Purpose:** Introduce StreamSave and ROSCA concept

**Content:**
- Hero section explaining StreamSave
- How it works (3-step process)
- Benefits vs traditional ROSCAs
- Testimonials/social proof
- Call-to-action: "Create Your ROSCA" or "Join a Circle"

**Technical:**
```typescript
// app/page.tsx
export default function LandingPage() {
  const { address, isConnected } = useAccount();

  // Redirect to dashboard if authenticated
  if (isConnected) {
    redirect('/dashboard');
  }

  return (
    <div>
      <Hero />
      <HowItWorks />
      <Benefits />
      <CTA />
    </div>
  );
}
```

### Protected Routes (Requires Wallet Connection)

#### Dashboard (`/dashboard`)
**Purpose:** Overview of user's ROSCAs

**Sections:**

1. **Active ROSCAs**
   - ROSCAs user created
   - ROSCAs user joined
   - Current round status
   - Next payout recipient
   - Payment status (paid/pending)

2. **ROSCA Cards**
   ```typescript
   interface ROSCACard {
     contractAddress: string;
     title: string;
     description: string;
     totalParticipants: number;
     contributionAmount: number; // USDC
     currentRound: number;
     userStatus: 'creator' | 'participant';
     paymentStatus: 'paid' | 'pending' | 'upcoming';
     nextPayoutDate: Date;
     isComplete: boolean;
   }
   ```

3. **Quick Actions**
   - Create New ROSCA
   - View Invitations
   - Track Payments

**Layout:**
```typescript
// app/dashboard/page.tsx
export default function Dashboard() {
  const { address } = useAccount();
  const { data: roscas } = useUserROSCAs(address);

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <h1>My ROSCAs</h1>
        <Button onClick={() => router.push('/create')}>
          Create New ROSCA
        </Button>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <ROSCAGrid roscas={roscas.active} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### ROSCA Detail (`/rosca/[contractAddress]`)
**Purpose:** Detailed view of specific ROSCA

**Information Displayed:**

1. **Overview Section**
   - Title & description
   - Total pool amount
   - Contribution per round
   - Cycle duration
   - Total rounds
   - Contract address (with explorer link)

2. **Participants List**
   - Privacy-preserving (nullifiers or anonymous IDs)
   - Current round recipient highlighted
   - Payment status per participant
   - Join order/payout order

3. **Transaction History**
   - All contributions tracked
   - Payouts distributed
   - Round progression
   - Event timeline

4. **Payment Actions**
   - "Sign Payment" button (if pending)
   - "Track Contribution" button (after facilitator transfer)
   - Payment status indicator

5. **Round Progress**
   - Visual progress bar: 5/10 participants paid
   - "Next payout in: 2 days"
   - Countdown to next round

**Component Structure:**
```typescript
// app/rosca/[contractAddress]/page.tsx
export default function ROSCADetail({ params }) {
  const { address } = useAccount();
  const { data: rosca } = useROSCAInfo(params.contractAddress);
  const { data: participant } = useParticipantInfo(params.contractAddress, address);
  const currentRound = rosca?.currentRound;

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <ROSCAHeader rosca={rosca} />

      {/* Status Banner */}
      <PaymentStatusBanner
        isPending={participant?.needsPayment}
        isWinner={participant?.isCurrentWinner}
        round={currentRound}
      />

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ROSCAOverview rosca={rosca} />
        </TabsContent>

        <TabsContent value="participants">
          <ParticipantsList
            participants={rosca.participants}
            currentRound={currentRound}
          />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionHistory contractAddress={params.contractAddress} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### Create ROSCA (`/create`)
**Purpose:** Wizard to create new ROSCA

**Steps:**

**Step 1: Basic Info**
- ROSCA title (required)
- Description (optional)
- Visual/icon selection

**Step 2: Parameters**
```typescript
interface ROSCAParams {
  contributionAmount: number;      // e.g., 10 USDC
  cycleDuration: number;           // e.g., 30 days
  totalParticipants: number;       // e.g., 10 people
  streamRate?: number;             // Optional: flexible streaming
}
```

**Step 3: Participants**
- Add participant wallet addresses
- Or generate invitation links
- Privacy option: Generate nullifiers

**Step 4: Review & Deploy**
- Summary of all parameters
- Estimated gas costs
- "Deploy ROSCA" button

**Technical Flow:**
```typescript
// app/create/page.tsx
export default function CreateROSCA() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<ROSCAFormData>({});

  const { writeContract } = useWriteContract();

  const deployROSCA = async () => {
    // Generate merkle tree from participants
    const merkleTree = generateMerkleTree(formData.participants);

    // Deploy via factory or direct
    await writeContract({
      address: FACTORY_ADDRESS,
      abi: FactoryABI,
      functionName: 'createROSCA',
      args: [
        USDC_ADDRESS,
        merkleTree.root,
        formData.contributionAmount,
        formData.streamRate,
        formData.cycleDuration,
        formData.totalParticipants
      ]
    });
  };

  return (
    <div className="container mx-auto py-8">
      <StepIndicator currentStep={step} totalSteps={4} />

      {step === 1 && <BasicInfoStep onNext={setFormData} />}
      {step === 2 && <ParametersStep onNext={setFormData} />}
      {step === 3 && <ParticipantsStep onNext={setFormData} />}
      {step === 4 && <ReviewStep formData={formData} onDeploy={deployROSCA} />}
    </div>
  );
}
```

#### Invitations (`/invitations`)
**Purpose:** View and accept ROSCA invitations

**Features:**
- List of pending invitations
- ROSCA details preview
- "Accept" or "Decline" actions
- Join ROSCA flow

**Accept Flow:**
```typescript
// When user accepts invitation
const acceptInvitation = async (roscaAddress: string, nullifier: string) => {
  const { data: merkleProof } = await generateMerkleProof(nullifier);

  // Call joinROSCA on contract
  await writeContract({
    address: roscaAddress,
    abi: StreamSaveROSCAABI,
    functionName: 'joinROSCA',
    args: [
      nullifier,
      address, // user's payout address
      merkleProof
    ]
  });

  // Navigate to ROSCA detail
  router.push(`/rosca/${roscaAddress}`);
};
```

#### Profile (`/profile`)
**Purpose:** User settings and history

**Sections:**
1. **Wallet Info**
   - Connected address
   - USDC balance
   - Network indicator

2. **Statistics**
   - Total ROSCAs joined
   - Total contributed
   - Total received
   - Success rate

3. **Settings**
   - Notification preferences
   - Privacy settings
   - Language/currency

## Key Components

### Header Component
```typescript
// components/Header.tsx
export function Header() {
  const { address, isConnected } = useAccount();

  return (
    <header className="border-b">
      <div className="container mx-auto flex items-center justify-between py-4">
        <Logo />

        {isConnected ? (
          <>
            <Navigation />
            <div className="flex items-center gap-4">
              <NotificationBell />
              <WalletButton address={address} />
            </div>
          </>
        ) : (
          <ConnectButton />
        )}
      </div>
    </header>
  );
}
```

### Navigation Menu (Authenticated)
```typescript
const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Create ROSCA', href: '/create', icon: PlusCircle },
  { label: 'Invitations', href: '/invitations', icon: Mail },
  { label: 'Profile', href: '/profile', icon: User },
];
```

### Payment Flow Component

**Sign Payment Button:**
```typescript
export function SignPaymentButton({ roscaAddress, amount }) {
  const { address } = useAccount();
  const [signature, setSignature] = useState(null);

  const signPayment = async () => {
    // Sign EIP-3009 authorization
    const nonce = generateNonce();

    const signature = await signTypedData({
      domain: {
        name: 'USD Coin',
        version: '2',
        chainId: 42220, // Celo
        verifyingContract: USDC_ADDRESS
      },
      types: {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' }
        ]
      },
      message: {
        from: address,
        to: roscaAddress,
        value: amount,
        validAfter: 0,
        validBefore: maxUint256,
        nonce: nonce
      }
    });

    setSignature(signature);

    // Send to backend/facilitator
    await sendToFacilitator({
      signature,
      from: address,
      to: roscaAddress,
      amount,
      nonce
    });
  };

  return (
    <Button
      onClick={signPayment}
      disabled={!!signature}
    >
      {signature ? 'Payment Signed ✓' : 'Sign Payment'}
    </Button>
  );
}
```

**Track Contribution Button:**
```typescript
export function TrackContributionButton({ roscaAddress, nullifier, amount }) {
  const { writeContract, isPending } = useWriteContract();

  const trackContribution = async () => {
    await writeContract({
      address: roscaAddress,
      abi: StreamSaveROSCAABI,
      functionName: 'trackContribution',
      args: [nullifier, amount]
    });
  };

  return (
    <Button onClick={trackContribution} disabled={isPending}>
      {isPending ? 'Tracking...' : 'Track Contribution'}
    </Button>
  );
}
```

### Event Monitoring

**Auto-refresh on events:**
```typescript
// hooks/useROSCAEvents.ts
export function useROSCAEvents(contractAddress: string) {
  const publicClient = usePublicClient();

  useEffect(() => {
    const unwatch = publicClient.watchContractEvent({
      address: contractAddress,
      abi: StreamSaveROSCAABI,
      eventName: 'AutoPayoutTriggered',
      onLogs: (logs) => {
        // Show notification
        toast.success('Payout distributed automatically!');

        // Refresh ROSCA data
        queryClient.invalidateQueries(['rosca', contractAddress]);
      }
    });

    return () => unwatch();
  }, [contractAddress]);
}
```

## User Flows

### Flow 1: Create ROSCA

```
User clicks "Create ROSCA"
    ↓
Fill basic info (title, description)
    ↓
Set parameters (amount, duration, participants)
    ↓
Add participant addresses
    ↓
Review summary
    ↓
Click "Deploy ROSCA"
    ↓
Wallet confirms transaction
    ↓
Contract deployed (via app private key or user wallet)
    ↓
Generate invitation links
    ↓
Share with participants
```

### Flow 2: Join ROSCA

```
User receives invitation link
    ↓
Connect wallet
    ↓
View ROSCA details
    ↓
Click "Accept Invitation"
    ↓
Provide payout address (pre-filled with connected wallet)
    ↓
Sign joinROSCA transaction
    ↓
Joined! Navigate to ROSCA detail
```

### Flow 3: Make Payment

```
User opens ROSCA detail page
    ↓
Sees "Payment Pending" status
    ↓
Click "Sign Payment"
    ↓
Wallet prompts for EIP-3009 signature
    ↓
User signs (no gas, just signature)
    ↓
Signature sent to facilitator
    ↓
Facilitator calls USDC.transferWithAuthorization()
    ↓
USDC arrives at ROSCA contract
    ↓
User/Facilitator clicks "Track Contribution"
    ↓
Contract records payment
    ↓
If all paid → Automatic payout triggered!
    ↓
Winner receives USDC instantly
    ↓
UI shows "Round Complete" + next round begins
```

### Flow 4: Receive Payout

```
User is current round recipient
    ↓
Dashboard shows "You're next to receive!"
    ↓
Waiting for all participants to pay
    ↓
Last participant pays
    ↓
Contract automatically sends USDC
    ↓
UI shows notification: "You received 100 USDC!"
    ↓
Transaction appears in history
    ↓
User's wallet balance updated
```

## Real-Time Updates

### Event Listeners
```typescript
// Listen for all ROSCA events
const events = [
  'ParticipantJoined',
  'ContributionTracked',
  'AutoPayoutTriggered',
  'PayoutDistributed',
  'ROSCACompleted'
];

events.forEach(eventName => {
  publicClient.watchContractEvent({
    address: roscaAddress,
    abi: StreamSaveROSCAABI,
    eventName,
    onLogs: handleEvent
  });
});
```

### Notifications
- Browser notifications (with permission)
- In-app toast messages
- Email notifications (optional)
- Dashboard badge indicators

## Payment Status Indicators

```typescript
type PaymentStatus =
  | 'not_started'      // ROSCA not started yet
  | 'pending_payment'  // Need to sign payment
  | 'signed'           // Signed, waiting for facilitator
  | 'transferred'      // USDC transferred, need to track
  | 'tracked'          // Contribution tracked
  | 'complete'         // Round complete, payout distributed
  | 'waiting'          // Waiting for other participants

// Visual indicators
const statusConfig = {
  not_started: { color: 'gray', icon: Clock },
  pending_payment: { color: 'red', icon: AlertCircle },
  signed: { color: 'yellow', icon: CheckCircle },
  transferred: { color: 'blue', icon: ArrowRight },
  tracked: { color: 'green', icon: Check },
  complete: { color: 'green', icon: CheckCheck },
  waiting: { color: 'gray', icon: Clock }
};
```

## Deployment Considerations

### Who Deploys Contracts?

**Option 1: App Deploys (Backend Private Key)**
- Pros: Better UX, no gas cost for users
- Cons: Centralized deployment, app covers gas
- Implementation: Backend API endpoint triggers deployment

**Option 2: Creator Deploys (User Wallet)**
- Pros: Decentralized, user pays gas
- Cons: Requires gas in user wallet, friction
- Implementation: Frontend triggers wallet transaction

**Recommendation:** Start with Option 1, migrate to Option 2 later

### Backend API Endpoints

```typescript
// API routes
POST /api/rosca/deploy          // Deploy new ROSCA contract
POST /api/rosca/invite          // Generate invitation links
POST /api/facilitator/sign      // Send signed payment to facilitator
GET  /api/rosca/:address        // Get ROSCA details
GET  /api/user/:address/roscas  // Get user's ROSCAs
```

## Privacy Considerations

### Nullifier Generation
```typescript
// Generate privacy-preserving nullifier
function generateNullifier(address: string, secret: string): string {
  return keccak256(encodePacked(['address', 'string'], [address, secret]));
}
```

### Merkle Tree Construction
```typescript
// Build merkle tree from participant nullifiers
function buildMerkleTree(nullifiers: string[]): MerkleTree {
  const leaves = nullifiers.map(n => keccak256(n));
  return new MerkleTree(leaves, keccak256, { sortPairs: true });
}
```

## Technical Stack Summary

```typescript
// package.json dependencies
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "viem": "^2.0.0",
    "wagmi": "^2.0.0",
    "@rainbow-me/rainbowkit": "^2.0.0",
    "tailwindcss": "^3.0.0",
    "@radix-ui/react-*": "latest", // shadcn components
    "zustand": "^4.0.0",
    "merkletreejs": "^0.3.0"
  }
}
```

## Next Steps

1. ✅ Review [ROSCA-ARCHITECTURE.md](ROSCA-ARCHITECTURE.md) for contract details
2. ✅ Check [PROCESS.md](PROCESS.md) for complete flow
3. 🚧 Build landing page
4. 🚧 Implement dashboard
5. 🚧 Create ROSCA wizard
6. 🚧 Payment flow components
7. 🚧 Event monitoring system
