import { WaitForTransactionReceiptReturnType } from "viem";
import { waitForTransactionReceipt } from "@wagmi/core";
import { config as wagmiConfig } from "@/app/config/WagmiConfig";

type Callbacks__Type = {
    onPrompt?: () => void;
    onSubmitted?: (hash: `0x${string}`) => void;
    onSuccess?: (receipt: WaitForTransactionReceiptReturnType) => void;
    onError?: (err: unknown) => void;
};

export const submitAction = async (
    action: () => Promise<`0x${string}`>,
    callbacks: Callbacks__Type
) => {
    const { onPrompt, onSubmitted, onSuccess, onError } = callbacks;

    if (onPrompt) onPrompt();

    try {
        const hash = await action();

        if (onSubmitted) onSubmitted(hash);

        console.log("Getting receipt...");
        const receipt = await waitForTransactionReceipt(wagmiConfig, {
            hash,
        });

        if (onSuccess) onSuccess(receipt);
    } catch (err: any) {
        if (onError) {
            onError(err);
        }
        if ("message" in err) {
            console.log(err.message);
        }
        console.log(err);
    }
};