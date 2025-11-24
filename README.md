# Curve Finance Polygon Subgraph

Subgraph for indexing Curve Finance pools on Polygon.

## Quick Start

```bash
yarn install
yarn codegen
yarn build
yarn deploy
```

## Contract Addresses

- **StableSwap-NG Factory**: `0x1764ee18e8B3ccA4787249Ceb249356192594585`
- **TwoCrypto-NG Factory**: `0x8D9A0b1E32c7B7682AD3Ef3E54308eEc88Ed0e9F`
- **TriCrypto-NG Factory**: `0xF9d5EF0A4A0f5b16ddF0C4dC81A8B0f7c1B5c8a3`

## Structure

```
├── subgraph.yaml      # Subgraph manifest
├── schema.graphql     # GraphQL schema
├── src/               # Mappings and utilities
│   ├── mappings/     # Event handlers
│   └── utils/        # Helper functions
└── abis/              # Contract ABIs
```
