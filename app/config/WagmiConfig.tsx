import { cookieStorage, createStorage, http } from '@wagmi/core'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { baseSepolia } from '@reown/appkit/networks'

// Get projectId from https://dashboard.reown.com
export const projectId = "9191bf42ee58ce6d591f4a3c9214cbf4"

if (!projectId) {
    throw new Error('Project ID is not defined')


}

export const networks = [baseSepolia]

//Set up the Wagmi Adapter (Config)
export const wagmiAdapter = new WagmiAdapter({
    storage: createStorage({
        storage: cookieStorage
    }),
    ssr: true,
    projectId,
    networks,
    connectors: []
})

export const config = wagmiAdapter.wagmiConfig