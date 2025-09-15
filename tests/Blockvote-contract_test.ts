
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
