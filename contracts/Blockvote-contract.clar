
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
