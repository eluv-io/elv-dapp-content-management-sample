

# Eluvio MetaMask Content Management Sample

This is a sample test dapp illustrating Eluvio Fabric Content Management using 
MetaMask alongside the elv-client-js lib.

It is forked from the Metamask [Test Dapp](https://github.com/MetaMask/test-dapp).
which is hosted [here](https://metamask.github.io/test-dapp/).

### Setup

- Install [Node.js](https://nodejs.org) version 12
  - If you are using [nvm](https://github.com/creationix/nvm#installation) (recommended) running `nvm use` will automatically choose the right node version for you.
- Install [Yarn v1](https://yarnpkg.com/en/docs/install)
  - e.g. `npm install --global yarn`
- Run `yarn setup` to install dependencies and run any required post-install scripts
  - **Warning:** Do not use the `yarn` / `yarn install` command directly. The normal install command will skip required post-install scripts, leaving your development environment in an invalid state.
- Run `npm install`

### Run

After successful setup:
- `npm run start`
- open http://localhost:9011/

### Updating content with ElvClient

- Add either the Eluvio demov3 and/or main network to your metamask
  - Network name: Eluvio Content Fabric DemoV3
  - RPC URL: https://host-76-74-91-17.contentfabric.io/eth/
  - Chain ID: 955210
  - Currency Symbol: ELV

- In the matching Eluvio Content Fabric Browser:
  - Get your private key associated with the network, and add that account to your MetaMask
  - Verify your account is in the proper Content Admin Access Group
  - Select a content object inside a library to edit

- In the local source code `src/index.js`:
  - Change these constants to match your object:
```
    const libraryId = 'ilib3MUNGcWxTNmK2WCJ5HYCvpxdSfFE';
    const objectId = 'iq__2gT74zSivCodXieqM3pt52tQo2E3';
    const contentSpaceId = 'ispc3ANoVSzNA3P6t7abLR69ho5YPPZU';
```

- In the Eluvio MetaMask Content Management Sample:
  - Click `Connect` to connect your account
  - Click `eth_accounts` to verify your address
  - Click the `update content with elv_client` button to run through a CreateEditToken, EditContentObject, and FinalizeContentObject.

You'll be prompted by MetaMask plugin:
- Confirm the Contract Interaction
- Sign the `Eluvio Content Fabric Access Token`
- Confirm the Second Contract Interaction
- Verify the object's metadata now contains:
```
metamask_test_write: "write @ Wed Oct 05 2022 16:42:30 GMT-0700 (Pacific Daylight Time)"
```

