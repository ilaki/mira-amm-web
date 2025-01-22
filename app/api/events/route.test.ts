import {GET} from "../events/route";
import {NextRequest} from "next/server";
import {gql, request} from "graphql-request";
import {SQDIndexerUrl} from "@/src/utils/constants";

jest.mock("@/src/utils/constants", () => ({
  SQDIndexerUrl: "https://mock-squid-indexer.com",
}));

jest.mock("graphql-request", () => ({
  request: jest.fn(),
  gql: jest.fn((query) => "dummy_query"),
}));

jest.mock("@/app/api/shared/math", () => ({
  decimalize: jest.fn((amount, assetDecimals) => 123.0),
}));

describe("GET /api/events", () => {
  const mockRequest = request as jest.Mock;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if fromBlock or toBlock is missing", async () => {
    const req = new NextRequest("http://localhost/api/events?fromBlock=100"); // Missing toBlock

    const response = await GET(req);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Both 'fromBlock' and 'toBlock' are required",
    });
  });

  it("should return events for the given block range", async () => {
    const req = new NextRequest(
      "http://localhost/api/events?fromBlock=100&toBlock=200",
    );

    const mockActions = {
      actions: [
        {
          pool: {id: "pool1"},
          asset0: {id: "asset0", decimals: 6},
          asset1: {id: "asset1", decimals: 9},
          amount1Out: "1000",
          amount1In: "0",
          amount0Out: "0",
          amount0In: "500",
          reserves0After: "1000",
          reserves1After: "2001",
          type: "ADD_LIQUIDITY",
          transaction: "txn1",
          timestamp: 1234567890,
          blockNumber: 1,
        },
        {
          pool: {id: "pool2"},
          asset0: {id: "asset0", decimals: 9},
          asset1: {id: "asset1", decimals: 9},
          amount1Out: "1001",
          amount1In: "0",
          amount0Out: "0",
          amount0In: "300",
          reserves0After: "2000",
          reserves1After: "4000",
          type: "SWAP",
          transaction: "txn2",
          timestamp: 1234567891,
          blockNumber: 2,
        },
      ],
    };

    mockRequest.mockResolvedValueOnce(mockActions);

    const response = await GET(req);

    expect(response.status).toBe(200);
    const jsonResponse = await response.json();
    expect(jsonResponse).toEqual({
      events: [
        {
          block: {
            blockNumber: 1,
            blockTimestamp: 1234567890,
          },
          txnId: "txn1",
          txnIndex: 0,
          eventIndex: 0,
          maker: "pool1",
          pairId: "pool1",
          reserves: {
            asset0: expect.any(Number),
            asset1: expect.any(Number),
          },
          eventType: "join",
          amount0: expect.any(Number),
          amount1: expect.any(Number),
        },
        {
          block: {
            blockNumber: 2,
            blockTimestamp: 1234567891,
          },
          txnId: "txn2",
          txnIndex: 0,
          eventIndex: 0,
          maker: "pool2",
          pairId: "pool2",
          reserves: {
            asset0: 123,
            asset1: 123,
          },
          eventType: "swap",
          asset0In: 123,
          asset1Out: 123,
          priceNative: 0.2997002997002997, // dividing amount0In by amount1Out
        },
      ],
    });
    expect(mockRequest).toHaveBeenCalledWith({
      url: SQDIndexerUrl,
      document: "dummy_query",
      variables: {fromBlock: 100, toBlock: 200},
    });
  });

  it("should return an empty events array if no actions are found", async () => {
    const req = new NextRequest(
      "http://localhost/api/events?fromBlock=100&toBlock=200",
    );

    mockRequest.mockResolvedValueOnce({actions: []});

    const response = await GET(req);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({events: []});
  });

  it("should return a 500 error if there is an exception", async () => {
    const req = new NextRequest(
      "http://localhost/api/events?fromBlock=100&toBlock=200",
    );

    mockRequest.mockRejectedValueOnce(new Error("Network error"));

    const response = await GET(req);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Failed to fetch events data",
    });
  });
});
