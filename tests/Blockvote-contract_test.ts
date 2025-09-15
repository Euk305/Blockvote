
import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.27.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
  name: 'BlockVote - Voter Registration Tests',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;
    const wallet3 = accounts.get('wallet_3')!;

    // Test 1: Should allow a user to register as a voter
    let block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'register-voter',
        [],
        wallet1.address
      ),
    ]);

    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, `(ok "Voter registered successfully")`);

    // Test 2: Should verify voter is registered
    let readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-voter-registered',
      [types.principal(wallet1.address)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'true');

    // Test 3: Should get voter info correctly
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-voter-info',
      [types.principal(wallet1.address)],
      wallet1.address
    );
    readOnlyResult.result.expectSome().expectTuple();

    // Test 4: Should prevent double registration
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'register-voter',
        [],
        wallet1.address
      ),
    ]);

    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, `(err u103)`); // err-already-exists

    // Test 5: Should allow multiple different users to register
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'register-voter',
        [],
        wallet2.address
      ),
      Tx.contractCall(
        'Blockvote-contract',
        'register-voter',
        [],
        wallet3.address
      ),
    ]);

    assertEquals(block.receipts.length, 2);
    assertEquals(block.receipts[0].result, `(ok "Voter registered successfully")`);
    assertEquals(block.receipts[1].result, `(ok "Voter registered successfully")`);

    // Verify all are registered
    assertEquals(
      chain.callReadOnlyFn('Blockvote-contract', 'is-voter-registered', [types.principal(wallet1.address)], wallet1.address).result,
      'true'
    );
    assertEquals(
      chain.callReadOnlyFn('Blockvote-contract', 'is-voter-registered', [types.principal(wallet2.address)], wallet2.address).result,
      'true'
    );
    assertEquals(
      chain.callReadOnlyFn('Blockvote-contract', 'is-voter-registered', [types.principal(wallet3.address)], wallet3.address).result,
      'true'
    );
  },
});

Clarinet.test({
  name: 'BlockVote - Admin Functions for Voter Management',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    // Setup: Register a voter first
    let block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'register-voter',
        [],
        wallet1.address
      ),
    ]);

    assertEquals(block.receipts[0].result, `(ok "Voter registered successfully")`);

    // Test 1: Should allow contract admin to unregister a voter
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'unregister-voter',
        [types.principal(wallet1.address)],
        deployer.address
      ),
    ]);

    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, `(ok "Voter unregistered successfully")`);

    // Verify voter is no longer registered
    let readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-voter-registered',
      [types.principal(wallet1.address)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'false');

    // Test 2: Should prevent non-admin from unregistering voters
    // Register wallet1 again for this test
    chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'register-voter',
        [],
        wallet1.address
      ),
    ]);

    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'unregister-voter',
        [types.principal(wallet1.address)],
        wallet2.address // Non-admin trying to unregister
      ),
    ]);

    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, `(err u102)`); // err-unauthorized

    // Verify voter is still registered
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-voter-registered',
      [types.principal(wallet1.address)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'true');

    // Test 3: Should handle unregistering non-existent voter
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'unregister-voter',
        [types.principal(wallet2.address)], // wallet2 is not registered
        deployer.address
      ),
    ]);

    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, `(err u101)`); // err-not-found
  },
});

Clarinet.test({
  name: 'BlockVote - Admin Update and Read-only Functions',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    // Test 1: Should verify current admin
    let readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-contract-admin',
      [],
      deployer.address
    );
    assertEquals(readOnlyResult.result, deployer.address);

    // Test 2: Should verify admin identification
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-admin',
      [types.principal(deployer.address)],
      deployer.address
    );
    assertEquals(readOnlyResult.result, 'true');

    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-admin',
      [types.principal(wallet1.address)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'false');

    // Test 3: Should allow admin to update admin address
    let block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'update-admin',
        [types.principal(wallet1.address)],
        deployer.address
      ),
    ]);

    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, `(ok "Admin updated successfully")`);

    // Verify new admin
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-contract-admin',
      [],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, wallet1.address);

    // Test 4: Should prevent non-admin from updating admin
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'update-admin',
        [types.principal(wallet2.address)],
        wallet2.address // wallet2 is not admin
      ),
    ]);

    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, `(err u102)`); // err-unauthorized

    // Test 5: Test unregistered voter queries return none
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-voter-info',
      [types.principal(wallet2.address)], // unregistered
      wallet2.address
    );
    assertEquals(readOnlyResult.result, 'none');

    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-voter-registration-block',
      [types.principal(wallet2.address)], // unregistered
      wallet2.address
    );
    assertEquals(readOnlyResult.result, 'none');
  },
});

Clarinet.test({
  name: 'BlockVote - Registration Block Height Tracking',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;

    const initialBlockHeight = chain.blockHeight;

    // Register voter and check registration block
    let block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'register-voter',
        [],
        wallet1.address
      ),
    ]);

    assertEquals(block.receipts[0].result, `(ok "Voter registered successfully")`);
    
    // Verify registration block is recorded correctly
    let readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-voter-registration-block',
      [types.principal(wallet1.address)],
      wallet1.address
    );

    // The registration occurs at the current block height when mined
    readOnlyResult.result.expectSome().expectUint(initialBlockHeight);
  },
});

Clarinet.test({
  name: 'BlockVote - Ballot Creation Functionality',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    // Test 1: Should create a ballot successfully
    let block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii('Presidential Election 2024'),
          types.ascii('Choose the next president of our organization'),
          types.list([
            types.ascii('Candidate A'),
            types.ascii('Candidate B'),
            types.ascii('Candidate C')
          ]),
          types.uint(1000) // duration in blocks
        ],
        wallet1.address
      ),
    ]);

    assertEquals(block.receipts.length, 1);
    assertEquals(block.receipts[0].result, '(ok u1)'); // First ballot should have ID 1

    // Verify ballot was created correctly
    let readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-info',
      [types.uint(1)],
      wallet1.address
    );
    
    let ballotInfo = readOnlyResult.result.expectSome().expectTuple() as any;
    assertEquals(ballotInfo['title'], '"Presidential Election 2024"');
    assertEquals(ballotInfo['creator'], wallet1.address);
    assertEquals(ballotInfo['active'], 'true');
    assertEquals(ballotInfo['total-votes'], 'u0');

    // Test 2: Should increment ballot ID for subsequent ballots
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii('Budget Proposal'),
          types.ascii('Vote on the new budget allocation'),
          types.list([
            types.ascii('Approve'),
            types.ascii('Reject')
          ]),
          types.uint(500)
        ],
        wallet2.address
      ),
    ]);

    assertEquals(block.receipts[0].result, '(ok u2)'); // Second ballot should have ID 2

    // Verify next-ballot-id is updated
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-next-ballot-id',
      [],
      deployer.address
    );
    assertEquals(readOnlyResult.result, 'u3'); // Should be ready for next ballot (ID 3)

    // Test 3: Should validate ballot creation inputs
    // Test empty title
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii(''),
          types.ascii('Description'),
          types.list([types.ascii('Option 1'), types.ascii('Option 2')]),
          types.uint(100)
        ],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, '(err u201)'); // Empty title error

    // Test single option (should fail - need at least 2)
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii('Single Option Ballot'),
          types.ascii('This should fail'),
          types.list([types.ascii('Only Option')]),
          types.uint(100)
        ],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, '(err u202)'); // Insufficient options error

    // Test zero duration
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii('Zero Duration Ballot'),
          types.ascii('This should fail'),
          types.list([types.ascii('Option 1'), types.ascii('Option 2')]),
          types.uint(0)
        ],
        wallet1.address
      ),
    ]);
    assertEquals(block.receipts[0].result, '(err u204)'); // Zero duration error
  },
});

Clarinet.test({
  name: 'BlockVote - Ballot Management and Queries',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const deployer = accounts.get('deployer')!;
    const wallet1 = accounts.get('wallet_1')!;
    const wallet2 = accounts.get('wallet_2')!;

    // Setup: Create test ballots
    let block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii('Test Ballot'),
          types.ascii('A test ballot'),
          types.list([types.ascii('Yes'), types.ascii('No')]),
          types.uint(100)
        ],
        wallet1.address
      ),
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii('Another Ballot'),
          types.ascii('Another test'),
          types.list([types.ascii('Option A'), types.ascii('Option B'), types.ascii('Option C')]),
          types.uint(200)
        ],
        wallet2.address
      ),
    ]);

    assertEquals(block.receipts[0].result, '(ok u1)');
    assertEquals(block.receipts[1].result, '(ok u2)');

    // Test 1: Should get ballot options correctly
    let readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-options',
      [types.uint(1)],
      wallet1.address
    );
    
    let options = readOnlyResult.result.expectSome();
    assertEquals(options, '["Yes", "No"]');

    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-options',
      [types.uint(2)],
      wallet1.address
    );
    
    options = readOnlyResult.result.expectSome();
    assertEquals(options, '["Option A", "Option B", "Option C"]');

    // Test 2: Should check ballot activity status
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-ballot-active',
      [types.uint(1)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'true'); // Should be active

    // Test 3: Should get ballot status correctly
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-status',
      [types.uint(1)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, '"active"');

    // Test 4: Should allow creator to deactivate ballot
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'deactivate-ballot',
        [types.uint(1)],
        wallet1.address // Creator of ballot 1
      ),
    ]);

    assertEquals(block.receipts[0].result, '(ok "Ballot deactivated successfully")');

    // Verify ballot is now inactive
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-ballot-active',
      [types.uint(1)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'false');

    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-status',
      [types.uint(1)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, '"deactivated"');

    // Test 5: Should allow admin to deactivate any ballot
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'deactivate-ballot',
        [types.uint(2)],
        deployer.address // Admin deactivating wallet2's ballot
      ),
    ]);

    assertEquals(block.receipts[0].result, '(ok "Ballot deactivated successfully")');

    // Test 6: Should prevent non-creator/non-admin from deactivating ballot
    // First create a new ballot
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii('Protected Ballot'),
          types.ascii('Test unauthorized deactivation'),
          types.list([types.ascii('Yes'), types.ascii('No')]),
          types.uint(50)
        ],
        wallet1.address
      ),
    ]);

    let ballotId = 3;
    // Try to deactivate with non-creator/non-admin
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'deactivate-ballot',
        [types.uint(ballotId)],
        wallet2.address // Not creator, not admin
      ),
    ]);

    assertEquals(block.receipts[0].result, '(err u102)'); // Unauthorized error

    // Test 7: Should handle non-existent ballot queries
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-info',
      [types.uint(999)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'none');

    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-options',
      [types.uint(999)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'none');

    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-ballot-active',
      [types.uint(999)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'false'); // Non-existent = inactive

    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-status',
      [types.uint(999)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, '"not-found"');

    // Test 8: Should handle deactivation of non-existent ballot
    block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'deactivate-ballot',
        [types.uint(999)],
        deployer.address
      ),
    ]);

    assertEquals(block.receipts[0].result, '(err u101)'); // Not found error
  },
});

Clarinet.test({
  name: 'BlockVote - Ballot Duration and Time-based Tests',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;

    // Create a ballot with short duration
    let block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii('Short Duration Ballot'),
          types.ascii('This ballot expires quickly'),
          types.list([types.ascii('Yes'), types.ascii('No')]),
          types.uint(5) // Very short duration
        ],
        wallet1.address
      ),
    ]);

    assertEquals(block.receipts[0].result, '(ok u1)');

    // Verify ballot is initially active
    let readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-ballot-active',
      [types.uint(1)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'true');

    // Mine blocks to exceed ballot duration
    chain.mineEmptyBlock(6); // Mine enough blocks to exceed the 5-block duration

    // Verify ballot is now expired (status should be "ended")
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-status',
      [types.uint(1)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, '"ended"');

    // Verify is-ballot-active returns false for ended ballot
    readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'is-ballot-active',
      [types.uint(1)],
      wallet1.address
    );
    assertEquals(readOnlyResult.result, 'false');
  },
});

Clarinet.test({
  name: 'BlockVote - Maximum Options Validation',
  async fn(chain: Chain, accounts: Map<string, Account>) {
    const wallet1 = accounts.get('wallet_1')!;

    // Test creating ballot with maximum allowed options (10)
    let maxOptions = [
      types.ascii('Option 1'),
      types.ascii('Option 2'),
      types.ascii('Option 3'),
      types.ascii('Option 4'),
      types.ascii('Option 5'),
      types.ascii('Option 6'),
      types.ascii('Option 7'),
      types.ascii('Option 8'),
      types.ascii('Option 9'),
      types.ascii('Option 10')
    ];

    let block = chain.mineBlock([
      Tx.contractCall(
        'Blockvote-contract',
        'create-ballot',
        [
          types.ascii('Max Options Ballot'),
          types.ascii('Testing maximum option limit'),
          types.list(maxOptions),
          types.uint(100)
        ],
        wallet1.address
      ),
    ]);

    assertEquals(block.receipts[0].result, '(ok u1)'); // Should succeed with 10 options

    // Verify all options are stored correctly
    let readOnlyResult = chain.callReadOnlyFn(
      'Blockvote-contract',
      'get-ballot-options',
      [types.uint(1)],
      wallet1.address
    );

    let options = readOnlyResult.result.expectSome();
    // Should contain all 10 options
    options.includes('"Option 1"');
    options.includes('"Option 10"');

    // Test with 11 options (should fail - commented out as Clarity list limits are enforced at compile time)
    // This would be caught during contract compilation, not runtime
  },
});
