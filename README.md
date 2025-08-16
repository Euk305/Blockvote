# BlockVote - Blockchain Voting System

A secure, transparent, and tamper-proof blockchain voting system built on the Stacks blockchain using Clarity smart contracts.

## Overview

BlockVote is a decentralized voting platform that enables:
- **Voter Registration**: Users can register themselves as eligible voters
- **Ballot Creation**: Anyone can create ballots with multiple options and time limits
- **Secure Voting**: Registered voters can cast votes with built-in validation
- **Tamper-Proof Counting**: Transparent and immutable vote tallying
- **Real-time Results**: Query vote counts and ballot status at any time

## Features

### 🔐 Security Features
- Voter registration validation
- Duplicate vote prevention
- Time-bound voting periods
- Admin authorization controls
- Immutable vote records on blockchain

### 📊 Voting Capabilities
- Multi-option ballots (up to 10 options)
- Vote changing (during active period)
- Real-time vote counting
- Ballot deactivation controls
- Comprehensive result queries

### 🛡️ Blockchain Benefits
- **Transparency**: All votes are publicly verifiable
- **Immutability**: Vote records cannot be altered
- **Decentralization**: No single point of failure
- **Auditability**: Complete voting history on-chain

## Smart Contract Architecture

### Data Structures

#### Voters Map
```clarity
(define-map voters
  {voter: principal}
  {registered: bool, registration-block: uint})
```

#### Ballots Map
```clarity
(define-map ballots
  {ballot-id: uint}
  {title: (string-ascii 100),
   description: (string-ascii 500),
   options: (list 10 (string-ascii 100)),
   creator: principal,
   start-block: uint,
   end-block: uint,
   active: bool,
   total-votes: uint})
```

#### Votes Map
```clarity
(define-map votes
  {ballot-id: uint, voter: principal}
  {option-index: uint, vote-block: uint})
```

#### Vote Counts Map
```clarity
(define-map vote-counts
  {ballot-id: uint, option-index: uint}
  {count: uint})
```

## Key Functions

### Voter Registration
- `register-voter()`: Self-registration for voters
- `unregister-voter(voter)`: Admin function to remove voters
- `is-voter-registered(voter)`: Check registration status

### Ballot Management
- `create-ballot(title, description, options, duration-blocks)`: Create new ballot
- `deactivate-ballot(ballot-id)`: Deactivate ballot (creator/admin only)
- `get-ballot-info(ballot-id)`: Get ballot details
- `is-ballot-active(ballot-id)`: Check if ballot is active

### Voting Functions
- `cast-vote(ballot-id, option-index)`: Cast a vote
- `change-vote(ballot-id, new-option-index)`: Change existing vote
- `has-voter-voted(ballot-id, voter)`: Check if voter has voted
- `get-voter-choice(ballot-id, voter)`: Get voter's choice

### Results & Analytics
- `get-vote-count(ballot-id, option-index)`: Get votes for specific option
- `get-ballot-results(ballot-id)`: Get comprehensive ballot results
- `get-option-result(ballot-id, option-index)`: Get detailed option result

### Administrative
- `update-admin(new-admin)`: Transfer admin rights
- `get-contract-admin()`: Get current admin
- `is-admin(user)`: Check admin status

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| u100 | err-owner-only | Only contract owner can perform this action |
| u101 | err-not-found | Requested resource not found |
| u102 | err-unauthorized | User not authorized for this action |
| u103 | err-already-exists | Resource already exists |
| u104 | err-already-voted | Voter has already voted on this ballot |
| u105 | err-ballot-inactive | Ballot is not active |
| u106 | err-invalid-option | Invalid option index |
| u107 | err-ballot-ended | Ballot voting period has ended |
| u201 | - | Title cannot be empty |
| u202 | - | Must have at least 2 options |
| u203 | - | Maximum 10 options allowed |
| u204 | - | Duration must be greater than 0 |
| u205 | - | Cannot change to same option |

## Development Setup

### Prerequisites
- [Clarinet](https://github.com/hirosystems/clarinet) - Stacks development environment
- [Node.js](https://nodejs.org/) - For running tests
- Git - Version control

### Installation
```bash
# Clone the repository
git clone https://github.com/Euk305/Blockvote.git
cd Blockvote

# Check contract syntax
clarinet check

# Run tests
clarinet test
```

### Project Structure
```
Blockvote/
├── contracts/
│   └── Blockvote-contract.clar    # Main smart contract
├── tests/
│   └── Blockvote-contract_test.ts # Test suite
├── settings/
│   └── Devnet.toml               # Development configuration
├── Clarinet.toml                 # Project configuration
└── README.md                     # This file
```

## Usage Examples

### 1. Register as a Voter
```clarity
(contract-call? .Blockvote-contract register-voter)
```

### 2. Create a Ballot
```clarity
(contract-call? .Blockvote-contract create-ballot
  "Should we implement feature X?"
  "Vote on whether to add this new feature to our platform"
  (list "Yes" "No" "Need more info")
  u1000)  ;; Active for 1000 blocks
```

### 3. Cast a Vote
```clarity
(contract-call? .Blockvote-contract cast-vote u1 u0)  ;; Vote for option 0 on ballot 1
```

### 4. Check Results
```clarity
(contract-call? .Blockvote-contract get-ballot-results u1)
```

## Security Considerations

### Implemented Protections
- ✅ Voter registration validation
- ✅ Duplicate vote prevention
- ✅ Time-bound voting periods
- ✅ Input validation and sanitization
- ✅ Authorization checks for admin functions
- ✅ Immutable vote records

### Best Practices
- Always verify voter registration before voting
- Use reasonable ballot durations
- Validate all inputs before submission
- Monitor contract events for suspicious activity

## Development History

The project was developed incrementally in 4 commits:

1. **Commit 1**: Core data structures and error handling
2. **Commit 2**: Voter registration system with admin controls
3. **Commit 3**: Ballot creation with validation and timing
4. **Commit 4**: Secure voting mechanism and vote counting

## Testing

Run the test suite to verify contract functionality:

```bash
clarinet test
```

Tests cover:
- Voter registration flow
- Ballot creation validation
- Voting mechanism security
- Error handling
- Edge cases and attack vectors

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

### Upcoming Features
- [ ] Multi-signature ballot creation
- [ ] Weighted voting based on stake
- [ ] Delegation and proxy voting
- [ ] Anonymous voting with zero-knowledge proofs
- [ ] Integration with Stacks governance

### Performance Improvements
- [ ] Gas optimization
- [ ] Batch voting operations
- [ ] Enhanced query functions
- [ ] Event logging system

## Support

For questions, issues, or contributions:
- Create an issue on GitHub
- Join our community discussions
- Review the Clarity documentation: [docs.stacks.co](https://docs.stacks.co)

## Acknowledgments

- Built on the [Stacks](https://stacks.co) blockchain
- Uses the [Clarity](https://clarity-lang.org) smart contract language
- Developed with [Clarinet](https://github.com/hirosystems/clarinet) framework

---

**BlockVote** - Empowering democratic decision-making through blockchain technology. 🗳️⛓️
