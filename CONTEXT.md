# Morrow glossary

- **Operator**: the organization or person funding a milestone. Morrow does not store their address in the grant entry.
- **Recipient**: the person who holds the claim secret and receives a private STRK20 note.
- **Milestone**: one escrowed token amount with a public deadline and two private resolution secrets.
- **Claim commitment**: a domain-separated Poseidon hash of the recipient's secret; it is the milestone's public identifier.
- **Recovery commitment**: a separately domain-separated Poseidon hash of the operator's recovery secret.
- **Resolved**: the irreversible terminal state after either claim or recovery. A milestone cannot take both paths.
- **Private**: hidden by STRK20 from public observers. It does not mean invisible to the protocol's lawful auditor path.
