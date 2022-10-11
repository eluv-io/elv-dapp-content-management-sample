import MetaMaskOnboarding from '@metamask/onboarding';
import { ethers } from 'ethers';
import { ElvClient } from '@eluvio/elv-client-js';
import Pako from 'pako';
import { FileInfo } from './Files';

// eslint-disable-next-line import/extensions
const Utils = require('@eluvio/elv-client-js/src/Utils.js');

let ethersProvider;
let ethereum;
let walletAddress;

const currentUrl = new URL(window.location.href);
const forwarderOrigin =
  currentUrl.hostname === 'localhost' ? 'http://localhost:9010' : undefined;

const { isMetaMaskInstalled } = MetaMaskOnboarding;

// Dapp Status Section
const networkDiv = document.getElementById('network');
const chainIdDiv = document.getElementById('chainId');
const accountsDiv = document.getElementById('accounts');
const warningDiv = document.getElementById('warning');

// Basic Actions Section
const onboardButton = document.getElementById('connectButton');
const getAccountsButton = document.getElementById('getAccounts');
const getAccountsResults = document.getElementById('getAccountsResult');
const attachElvButton = document.getElementById('attachElv');

// Miscellaneous
const addEthereumChain = document.getElementById('addEthereumChain');
const switchEthereumChain = document.getElementById('switchEthereumChain');

const initialize = async () => {
  try {
    // We must specify the network as 'any' for ethers to allow network changes
    ethersProvider = new ethers.providers.Web3Provider(window.ethereum, 'any');
    ethereum = window.ethereum;
  } catch (error) {
    console.error(error);
  }

  /**
   * Get elv contract info abi, call `updateRequest` to generate an event,
   * and return that event, which will be used to get a transaction ID to sign.
   */
  const UpdateRequest = async ({ client, objectId }) => {
    // eslint-disable-next-line no-unused-vars
    const { isV3, accessType, abi } = await client.authClient.ContractInfo({
      id: objectId,
    });

    const event = await client.CallContractMethodAndWait({
      contractAddress: Utils.HashToAddress(objectId),
      abi,
      methodName: 'updateRequest',
      methodArgs: [],
    });

    const updateRequestEvent = client.ExtractEventFromLogs({
      abi,
      event,
      eventName: 'UpdateRequest',
    });

    if (event.logs.length === 0 || !updateRequestEvent) {
      throw Error(`Update request denied for ${objectId}`);
    }

    return event;
  };

  /**
   * Create a signed "EDIT" access token
   */
  const CreateEditToken = async ({
    client,
    contentSpaceId,
    libraryId,
    objectId,
    address,
  }) => {
    const event = await UpdateRequest({ client, objectId });
    const txh = event.transactionHash;
    console.log('txh', txh);

    const token = {
      txh: Buffer.from(txh.replace(/^0x/u, ''), 'hex').toString('base64'), // tx hash for an updateRequest
      adr: Buffer.from(address.replace(/^0x/u, ''), 'hex').toString('base64'),
      spc: contentSpaceId,
      lib: libraryId,
    };

    const message = `Eluvio Content Fabric Access Token 1.0\n${JSON.stringify(
      token,
    )}`;

    const signature = await ethereum.request({
      method: 'personal_sign',
      params: [address, message],
    });

    const compressedToken = Pako.deflateRaw(
      Buffer.from(JSON.stringify(token), 'utf-8'),
    );
    return `atxpjc${Utils.B58(
      Buffer.concat([
        Buffer.from(signature.replace(/^0x/u, ''), 'hex'),
        Buffer.from(compressedToken),
      ]),
    )}`;
  };

  /**
   * Create a manually personal_sign'd fabric token.
   */
  // eslint-disable-next-line no-unused-vars
  const CreateManualSignedToken = async (address, spaceId, duration) => {
    const token = {
      sub: `iusr${Utils.AddressToHash(address)}`,
      adr: Buffer.from(address.replace(/^0x/u, ''), 'hex').toString('base64'),
      spc: spaceId,
      iat: Date.now(),
      exp: Date.now() + duration,
    };
    const message = `Eluvio Content Fabric Access Token 1.0\n${JSON.stringify(
      token,
    )}`;
    console.log('token', token, 'message', message);

    // const signature = await signer.signMessage(message);
    const signature = await ethereum.request({
      method: 'personal_sign',
      params: [address, message],
    });
    console.log('signature', signature);

    const compressedToken = Pako.deflateRaw(
      Buffer.from(JSON.stringify(token), 'utf-8'),
    );

    return `acspjc${Utils.B58(
      Buffer.concat([
        Buffer.from(signature.replace(/^0x/u, ''), 'hex'),
        Buffer.from(compressedToken),
      ]),
    )}`;
  };

  // general path:
  // CreateObject
  // UploadFile
  // ProductionMaster.init

  const info = async (client, libraryId, objectId) => {
    console.log(`Getting info for library ${libraryId}...`);

    // const libResponse = await client.ContentLibrary({ libraryId, objectId });
    // const contractMetadata = {}; // libResponse.meta;
    // const objectId = libResponse.qid;

    const objResponse = await client.ContentObject({ libraryId, objectId });
    console.log(`objResponse`, objResponse);
    const latestHash = objResponse.hash;
    const { type } = objResponse;

    const metadata = await client.ContentObjectMetadata({
      libraryId,
      objectId,
    });
    console.log(`metadata`, metadata);

    return {
      latestHash,
      metadata,
      objectId,
      type,
    };
  };

  const Ingest = async (client, libraryId, contentSpaceId) => {
    // const libInfo = await info(client, libraryId, objectId);
    const type =
      'hq__HGpLJVDkeCNyz6k1FVXhotgrnYrgARuhafhjgCn7jBvA5avGgNEf57q1J5sd5diVzru6JG5KvD';
    const encrypt = false;

    const callback = (progress) => {
      Object.keys(progress)
        .sort()
        .forEach((filename) => {
          const { uploaded, total } = progress[filename];
          const percentage =
            total === 0
              ? '100.0%'
              : `${((100 * uploaded) / total).toFixed(1)}%`;
          console.log(`${filename}: ${percentage}`);
        });
    };

    client.ToggleLogging(true);
    console.log('CreateContentObject');
    const { contractAddress, transactionHash } =
      await client.authClient.CreateContentObject({
        libraryId,
        options: type ? { type } : {},
      });
    console.log('contractAddress', contractAddress);
    const newObjectId = "iq__" + client.utils.AddressToHash(contractAddress);
    console.log('newObjectId', newObjectId);

    await new Promise((resolve) => setTimeout(resolve, 15000));

    const editToken = await CreateEditToken({
      client,
      contentSpaceId,
      libraryId,
      objectId: newObjectId,
      address: walletAddress,
    });
    client.SetStaticToken({ token: editToken });
    console.log('editToken', editToken);

    try {
      const res = await client.EditContentObject({
        libraryId,
        objectId: newObjectId,
      });
      console.log('EDIT', res);

      // await client.MergeMetadata({
      //   libraryId,
      //   objectId,
      //   writeToken: res.write_token,
      //   metadata: { metamask_test_write: `write @ ${Date()}` },
      //   metadataSubtree: '/',
      // });
      //
      // const fin = await client.FinalizeContentObject({
      //   libraryId,
      //   objectId,
      //   writeToken: res.write_token,
      // });
      // console.log('FIN', fin);

      const fileInfo = await FileInfo('', ['BigBuckBunny_4k.video.00001.mp4']);

      console.log('UploadFiles');
      await client.UploadFiles({
        libraryId,
        objectId: newObjectId,
        writeToken: res.write_token,
        fileInfo,
        callback,
        encryption: encrypt ? 'cgck' : 'none',
      });
    } catch (e) {
      console.log('err', e);
    }
  };

  /**
   * Setup ElvClient and run through a CreateEditToken, EditContentObject,
   * and FinalizeContentObject.
   */
  const SetupElv = async () => {
    const networkName = 'demo';
    const client = await ElvClient.FromNetworkName({
      networkName,
    });

    let addr = await ethereum.request({ method: 'eth_accounts' });
    addr = addr[0]; // use first
    console.log('addr', addr);
    walletAddress = addr;

    // set provider
    console.log('ethersProvider', ethersProvider);
    await client.SetSignerFromWeb3Provider(ethersProvider);

    // set signDigest
    const signDigest = async (message) => {
      console.log('requesting personal_sign in signDigest');
      return await ethereum.request({
        method: 'personal_sign',
        params: [addr, message],
      });
    };
    client.signDigest = signDigest;
    client.signer.signDigest = signDigest;

    // override network user info request (commit author)
    client.userProfileClient.UserMetadata = () => {
      return `User with addr ${walletAddress}`;
    };

    const libraryId = 'ilib3MUNGcWxTNmK2WCJ5HYCvpxdSfFE';
    const objectId = 'iq__2gT74zSivCodXieqM3pt52tQo2E3';
    const contentSpaceId = 'ispc3ANoVSzNA3P6t7abLR69ho5YPPZU';

    const editToken = await CreateEditToken({
      client,
      contentSpaceId,
      libraryId,
      objectId,
      address: walletAddress,
    });
    console.log('editToken', editToken);

    // client.SetStaticToken({ token: editToken });

    try {
      console.log('trying ingest');
      const i = await Ingest(client, libraryId, contentSpaceId);
      console.log('ingest', i);
    } catch (e) {
      console.log('err', e);
    }
    return client;

    try {
      const res = await client.EditContentObject({
        libraryId,
        objectId,
      });
      console.log('EDIT', res);

      await client.MergeMetadata({
        libraryId,
        objectId,
        writeToken: res.write_token,
        metadata: { metamask_test_write: `write @ ${Date()}` },
        metadataSubtree: '/',
      });

      const fin = await client.FinalizeContentObject({
        libraryId,
        objectId,
        writeToken: res.write_token,
      });
      console.log('FIN', fin);
    } catch (e) {
      console.log('err', e);
    }

    return client;
  };

  let onboarding;
  try {
    onboarding = new MetaMaskOnboarding({ forwarderOrigin });
  } catch (error) {
    console.error(error);
  }

  let accounts;
  let accountButtonsInitialized = false;

  const isMetaMaskConnected = () => accounts && accounts.length > 0;

  const onClickInstall = () => {
    onboardButton.innerText = 'Onboarding in progress';
    onboardButton.disabled = true;
    onboarding.startOnboarding();
  };

  const onClickConnect = async () => {
    try {
      const newAccounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });
      handleNewAccounts(newAccounts);
    } catch (error) {
      console.error(error);
    }
  };

  const updateButtons = () => {
    if (isMetaMaskInstalled()) {
      addEthereumChain.disabled = false;
      switchEthereumChain.disabled = false;
    } else {
      onboardButton.innerText = 'Click here to install MetaMask!';
      onboardButton.onclick = onClickInstall;
      onboardButton.disabled = false;
    }

    if (isMetaMaskConnected()) {
      onboardButton.innerText = 'Connected';
      onboardButton.disabled = true;
      if (onboarding) {
        onboarding.stopOnboarding();
      }
    } else {
      onboardButton.innerText = 'Connect';
      onboardButton.onclick = onClickConnect;
      onboardButton.disabled = false;
    }
  };

  addEthereumChain.onclick = async () => {
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: '0x53a',
          rpcUrls: ['http://127.0.0.1:8546'],
          chainName: 'Localhost 8546',
          nativeCurrency: { name: 'TEST', decimals: 18, symbol: 'TEST' },
          blockExplorerUrls: null,
        },
      ],
    });
  };

  switchEthereumChain.onclick = async () => {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [
        {
          chainId: '0x53a',
        },
      ],
    });
  };

  const initializeAccountButtons = () => {
    if (accountButtonsInitialized) {
      return;
    }
    accountButtonsInitialized = true;

    getAccountsButton.onclick = async () => {
      try {
        const _accounts = await ethereum.request({
          method: 'eth_accounts',
        });
        getAccountsResults.innerHTML =
          _accounts[0] || 'Not able to get accounts';
      } catch (err) {
        console.error(err);
        getAccountsResults.innerHTML = `Error: ${err.message}`;
      }
    };

    attachElvButton.onclick = async () => {
      try {
        const client = await SetupElv();
        getAccountsResults.innerHTML = client.staticToken
          ? JSON.stringify(client.utils.DecodeSignedToken(client.staticToken))
          : 'Not able to get token';
      } catch (err) {
        console.error(err);
        getAccountsResults.innerHTML = `Error: ${err.message}`;
      }
    };
  };

  function handleNewAccounts(newAccounts) {
    accounts = newAccounts;
    accountsDiv.innerHTML = accounts;
    if (isMetaMaskConnected()) {
      initializeAccountButtons();
    }
    updateButtons();
  }

  function handleNewChain(chainId) {
    chainIdDiv.innerHTML = chainId;

    if (chainId === '0x1') {
      warningDiv.classList.remove('warning-invisible');
    } else {
      warningDiv.classList.add('warning-invisible');
    }
  }

  function handleEIP1559Support(supported) {
    if (supported && Array.isArray(accounts) && accounts.length >= 1) {
      // noop
    } else {
      // noop
    }
  }

  function handleNewNetwork(networkId) {
    networkDiv.innerHTML = networkId;
  }

  async function getNetworkAndChainId() {
    try {
      const chainId = await ethereum.request({
        method: 'eth_chainId',
      });
      handleNewChain(chainId);

      const networkId = await ethereum.request({
        method: 'net_version',
      });
      handleNewNetwork(networkId);

      const block = await ethereum.request({
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      });

      handleEIP1559Support(block.baseFeePerGas !== undefined);
    } catch (err) {
      console.error(err);
    }
  }

  updateButtons();

  if (isMetaMaskInstalled()) {
    ethereum.autoRefreshOnNetworkChange = false;
    getNetworkAndChainId();

    ethereum.autoRefreshOnNetworkChange = false;
    getNetworkAndChainId();

    ethereum.on('chainChanged', (chain) => {
      handleNewChain(chain);
      ethereum
        .request({
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
        })
        .then((block) => {
          handleEIP1559Support(block.baseFeePerGas !== undefined);
        });
    });
    ethereum.on('chainChanged', handleNewNetwork);
    ethereum.on('accountsChanged', (newAccounts) => {
      ethereum
        .request({
          method: 'eth_getBlockByNumber',
          params: ['latest', false],
        })
        .then((block) => {
          handleEIP1559Support(block.baseFeePerGas !== undefined);
        });
      handleNewAccounts(newAccounts);
    });

    try {
      const newAccounts = await ethereum.request({
        method: 'eth_accounts',
      });
      handleNewAccounts(newAccounts);
    } catch (err) {
      console.error('Error on init when getting accounts', err);
    }
  }
};

window.addEventListener('load', initialize);
