/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_GENLAYER_RPC_URL?: string;
  readonly VITE_GENLAYER_CHAIN_ID?: string;
  readonly VITE_EXPLORER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface Window {
  ethereum?: any;
}
