import { useCallback, useEffect, useState } from "react";
import { Address, WaitForTransactionReceiptReturnType, parseAbi } from "viem";
import { readContract, writeContract } from "@wagmi/core";
import { config as wagmiConfig } from "@/app/config/WagmiConfig";
import { submitAction } from "@/app/utils/submitAction";

type UseTokenApproveHook__Type = {
  allowance: bigint;
  approve: (amount: bigint) => Promise<void>;
  balance: bigint;
  fetchAllowance: () => Promise<void>;
  getTokenMetadata: () => Promise<{
    symbol: string;
    name: string;
    decimals: number;
  }>;
  loading: boolean;
};

const abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
]);

const metadataAbi = parseAbi([
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
]);

export const useToken = ({
  token,
  owner,
  spender,
  onPrompt,
  onSubmitted,
  onSuccess,
  onError,
}: {
  token?: Address;
  owner?: Address;
  spender?: Address;
  onPrompt?: () => void;
  onSubmitted?: (hash: `0x${string}`) => void;
  onSuccess?: (receipt: WaitForTransactionReceiptReturnType) => void;
  onError?: (err: unknown) => void;
}): UseTokenApproveHook__Type => {
  const [allowance, setAllowance] = useState<bigint>(BigInt(0));
  const [loading, setLoading] = useState<boolean>(false);
  const [balance, setBalance] = useState<bigint>(BigInt(0));



  const approve = async (amount: bigint) => {
    if (!token) return;
    if (!spender) return;
    if (token === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return;

    await submitAction(
      async () => {
        return await writeContract(wagmiConfig, {
          address: token,
          abi,
          functionName: "approve",
          args: [spender, amount],
          gas: BigInt(300000),
        });
      },
      {
        onPrompt: () => {
          setLoading(true);
          if (onPrompt) onPrompt();
        },
        onSubmitted,
        onSuccess: async (receipt: WaitForTransactionReceiptReturnType) => {
          setLoading(false);
          await fetchAllowance();
          if (onSuccess) onSuccess(receipt);
        },
        onError: (err: unknown) => {
          setLoading(false);
          if (onError) onError(err);
        },
      }
    );
  };

  const fetchAllowance = useCallback(async () => {
    if (!owner) return;
    if (!token) return;
    if (!spender) return;
    if (token === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return;

    const data = await readContract(wagmiConfig, {
      address: token,
      abi,
      functionName: "allowance",
      args: [owner, spender],
    });

    setAllowance(data);
  }, [owner, spender, token]);

  const fetchbalance = useCallback(async () => {
    if (!owner) return;
    if (!token) return;
    if (!spender) return;
    if (token === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") return;

    const data = await readContract(wagmiConfig, {
      address: token,
      abi,
      functionName: "balanceOf",
      args: [owner],
    });

    setBalance(data);
  }, [owner, token]);

  const getTokenMetadata = useCallback(async () => {
    if (!token) throw new Error("Token address is required");

    const [symbol, name, decimals] = await Promise.all([
      readContract(wagmiConfig, {
        address: token,
        abi: metadataAbi,
        functionName: "symbol",
      }),
      readContract(wagmiConfig, {
        address: token,
        abi: metadataAbi,
        functionName: "name",
      }),
      readContract(wagmiConfig, {
        address: token,
        abi: metadataAbi,
        functionName: "decimals",
      }),
    ]);

    return {
      symbol: symbol as string,
      name: name as string,
      decimals: decimals as number,
    };
  }, [token]);

  useEffect(() => {
    fetchAllowance();
    fetchbalance();
  }, [fetchAllowance]);

  return {
    allowance,
    balance,
    approve,
    fetchAllowance,
    getTokenMetadata,
    loading,
  };
};