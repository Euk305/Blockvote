
;; BlockVote Smart Contract
;; A secure blockchain voting system with voter registration, ballot creation, and tamper-proof vote counting

;; Constants and Error Codes
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-unauthorized (err u102))
(define-constant err-already-exists (err u103))
(define-constant err-already-voted (err u104))
(define-constant err-ballot-inactive (err u105))
(define-constant err-invalid-option (err u106))
(define-constant err-ballot-ended (err u107))

;; Data Variables
(define-data-var next-ballot-id uint u1)
(define-data-var contract-admin principal tx-sender)

;; Data Maps
;; Voter registration map: tracks all registered voters
(define-map voters
  {voter: principal}
  {registered: bool, registration-block: uint})

;; Ballots map: stores ballot information
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

;; Votes map: tracks individual votes (ballot-id + voter -> choice)
(define-map votes
  {ballot-id: uint, voter: principal}
  {option-index: uint, vote-block: uint})

;; Vote counts map: aggregates vote counts per option per ballot
(define-map vote-counts
  {ballot-id: uint, option-index: uint}
  {count: uint})

;; Read-only functions for data access
(define-read-only (get-contract-admin)
  (var-get contract-admin))

(define-read-only (get-next-ballot-id)
  (var-get next-ballot-id))

(define-read-only (is-voter-registered (voter principal))
  (default-to false (get registered (map-get? voters {voter: voter}))))

;; Private helper functions
(define-private (is-contract-admin)
  (is-eq tx-sender (var-get contract-admin)))

;; Public functions

;; Voter Registration Functions
(define-public (register-voter)
  (let ((voter-info (map-get? voters {voter: tx-sender})))
    (if (is-some voter-info)
        err-already-exists
        (begin
          (map-set voters 
            {voter: tx-sender}
            {registered: true, registration-block: block-height})
          (ok "Voter registered successfully")))))

(define-public (unregister-voter (voter principal))
  (if (is-contract-admin)
      (let ((voter-info (map-get? voters {voter: voter})))
        (if (is-some voter-info)
            (begin
              (map-delete voters {voter: voter})
              (ok "Voter unregistered successfully"))
            err-not-found))
      err-unauthorized))

(define-public (update-admin (new-admin principal))
  (if (is-contract-admin)
      (begin
        (var-set contract-admin new-admin)
        (ok "Admin updated successfully"))
      err-unauthorized))

;; Read-only functions for voter queries
(define-read-only (get-voter-info (voter principal))
  (map-get? voters {voter: voter}))

(define-read-only (get-voter-registration-block (voter principal))
  (match (map-get? voters {voter: voter})
    voter-data (some (get registration-block voter-data))
    none))

(define-read-only (is-admin (user principal))
  (is-eq user (var-get contract-admin)))

;; Ballot Creation Functions
(define-public (create-ballot 
    (title (string-ascii 100))
    (description (string-ascii 500))
    (options (list 10 (string-ascii 100)))
    (duration-blocks uint))
  (let ((ballot-id (var-get next-ballot-id))
        (start-block block-height)
        (end-block (+ block-height duration-blocks)))
    (begin
      ;; Validate inputs
      (asserts! (> (len title) u0) (err u201))
      (asserts! (> (len options) u1) (err u202))
      (asserts! (<= (len options) u10) (err u203))
      (asserts! (> duration-blocks u0) (err u204))
      ;; Create the ballot
      (map-set ballots
        {ballot-id: ballot-id}
        {title: title,
         description: description,
         options: options,
         creator: tx-sender,
         start-block: start-block,
         end-block: end-block,
         active: true,
         total-votes: u0})
      ;; Initialize vote counts for each option
      (fold initialize-vote-count options u0)
      ;; Increment ballot ID for next ballot
      (var-set next-ballot-id (+ ballot-id u1))
      (ok ballot-id))))

(define-public (deactivate-ballot (ballot-id uint))
  (let ((ballot-info (unwrap! (map-get? ballots {ballot-id: ballot-id}) err-not-found)))
    (begin
      ;; Only creator or admin can deactivate
      (asserts! (or (is-eq tx-sender (get creator ballot-info))
                    (is-contract-admin)) err-unauthorized)
      ;; Update ballot to inactive
      (map-set ballots
        {ballot-id: ballot-id}
        (merge ballot-info {active: false}))
      (ok "Ballot deactivated successfully"))))

;; Private helper function to initialize vote counts
(define-private (initialize-vote-count (option (string-ascii 100)) (index uint))
  (let ((ballot-id (var-get next-ballot-id)))
    (begin
      (map-set vote-counts
        {ballot-id: ballot-id, option-index: index}
        {count: u0})
      (+ index u1))))

;; Read-only functions for ballot queries
(define-read-only (get-ballot-info (ballot-id uint))
  (map-get? ballots {ballot-id: ballot-id}))

(define-read-only (get-ballot-options (ballot-id uint))
  (match (map-get? ballots {ballot-id: ballot-id})
    ballot-info (some (get options ballot-info))
    none))

(define-read-only (is-ballot-active (ballot-id uint))
  (match (map-get? ballots {ballot-id: ballot-id})
    ballot-info (and (get active ballot-info)
                     (<= block-height (get end-block ballot-info)))
    false))

(define-read-only (get-ballot-status (ballot-id uint))
  (match (map-get? ballots {ballot-id: ballot-id})
    ballot-info
    (if (get active ballot-info)
        (if (<= block-height (get end-block ballot-info))
            "active"
            "ended")
        "deactivated")
    "not-found"))

(define-read-only (get-ballots-by-creator (creator principal))
  (ok "Function to list ballots by creator - requires iteration support"))

;; Voting Functions
(define-public (cast-vote (ballot-id uint) (option-index uint))
  (let ((ballot-info (unwrap! (map-get? ballots {ballot-id: ballot-id}) err-not-found))
        (voter-info (unwrap! (map-get? voters {voter: tx-sender}) err-unauthorized))
        (existing-vote (map-get? votes {ballot-id: ballot-id, voter: tx-sender})))
    (begin
      ;; Validate voter is registered
      (asserts! (get registered voter-info) err-unauthorized)
      ;; Validate ballot is active and not ended
      (asserts! (get active ballot-info) err-ballot-inactive)
      (asserts! (<= block-height (get end-block ballot-info)) err-ballot-ended)
      ;; Validate voter hasn't already voted
      (asserts! (is-none existing-vote) err-already-voted)
      ;; Validate option index is within range
      (asserts! (< option-index (len (get options ballot-info))) err-invalid-option)
      
      ;; Record the vote
      (map-set votes
        {ballot-id: ballot-id, voter: tx-sender}
        {option-index: option-index, vote-block: block-height})
      
      ;; Update vote count for the option
      (let ((current-count (default-to u0 (get count (map-get? vote-counts {ballot-id: ballot-id, option-index: option-index})))))
        (map-set vote-counts
          {ballot-id: ballot-id, option-index: option-index}
          {count: (+ current-count u1)}))
      
      ;; Update total votes for the ballot
      (map-set ballots
        {ballot-id: ballot-id}
        (merge ballot-info {total-votes: (+ (get total-votes ballot-info) u1)}))
      
      (ok "Vote cast successfully"))))

(define-public (change-vote (ballot-id uint) (new-option-index uint))
  (let ((ballot-info (unwrap! (map-get? ballots {ballot-id: ballot-id}) err-not-found))
        (voter-info (unwrap! (map-get? voters {voter: tx-sender}) err-unauthorized))
        (existing-vote (unwrap! (map-get? votes {ballot-id: ballot-id, voter: tx-sender}) err-not-found)))
    (begin
      ;; Validate voter is registered
      (asserts! (get registered voter-info) err-unauthorized)
      ;; Validate ballot is active and not ended
      (asserts! (get active ballot-info) err-ballot-inactive)
      (asserts! (<= block-height (get end-block ballot-info)) err-ballot-ended)
      ;; Validate new option index is within range
      (asserts! (< new-option-index (len (get options ballot-info))) err-invalid-option)
      ;; Validate it's actually a different option
      (asserts! (not (is-eq (get option-index existing-vote) new-option-index)) (err u205))
      
      ;; Decrease count for old option
      (let ((old-option-index (get option-index existing-vote))
            (old-count (default-to u0 (get count (map-get? vote-counts {ballot-id: ballot-id, option-index: old-option-index})))))
        (map-set vote-counts
          {ballot-id: ballot-id, option-index: old-option-index}
          {count: (if (> old-count u0) (- old-count u1) u0)}))
      
      ;; Increase count for new option
      (let ((new-count (default-to u0 (get count (map-get? vote-counts {ballot-id: ballot-id, option-index: new-option-index})))))
        (map-set vote-counts
          {ballot-id: ballot-id, option-index: new-option-index}
          {count: (+ new-count u1)}))
      
      ;; Update the vote record
      (map-set votes
        {ballot-id: ballot-id, voter: tx-sender}
        {option-index: new-option-index, vote-block: block-height})
      
      (ok "Vote changed successfully"))))

;; Vote Counting and Results Functions
(define-read-only (get-vote-count (ballot-id uint) (option-index uint))
  (default-to u0 (get count (map-get? vote-counts {ballot-id: ballot-id, option-index: option-index}))))

(define-read-only (get-voter-choice (ballot-id uint) (voter principal))
  (map-get? votes {ballot-id: ballot-id, voter: voter}))

(define-read-only (has-voter-voted (ballot-id uint) (voter principal))
  (is-some (map-get? votes {ballot-id: ballot-id, voter: voter})))

(define-read-only (get-ballot-results (ballot-id uint))
  (match (map-get? ballots {ballot-id: ballot-id})
    ballot-info
    (ok {
      ballot-id: ballot-id,
      title: (get title ballot-info),
      total-votes: (get total-votes ballot-info),
      options: (get options ballot-info),
      status: (get-ballot-status ballot-id),
      creator: (get creator ballot-info),
      start-block: (get start-block ballot-info),
      end-block: (get end-block ballot-info)
    })
    err-not-found))

;; Simplified vote counting functions
(define-read-only (get-option-result (ballot-id uint) (option-index uint))
  (match (map-get? ballots {ballot-id: ballot-id})
    ballot-info
    (if (< option-index (len (get options ballot-info)))
        (ok {
          option-index: option-index,
          option-text: (unwrap-panic (element-at (get options ballot-info) option-index)),
          vote-count: (get-vote-count ballot-id option-index)
        })
        err-invalid-option)
    err-not-found))
