import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useTheme } from "next-themes";
import SuiGraphPage from "../page";

jest.mock("@mysten/dapp-kit", () => ({
  useCurrentAccount: jest.fn(() => null),
  useSignTransaction: jest.fn(() => ({ mutateAsync: jest.fn() })),
  useSuiClient: jest.fn(() => ({ executeTransactionBlock: jest.fn() })),
}));

jest.mock("next/dynamic", () => (fn) => fn());

jest.mock("react-force-graph-3d", () => () => <div>Mock ForceGraph3D</div>);

jest.mock("../../components/SuiMap", () => () => <div>Mock SuiMap</div>);

jest.mock("../../components/GlobeWrapper", () => () => <div>Mock Globe</div>);

jest.mock("../../components/SuiPageContent", () => () => (
  <div>Mock SuiPageContent</div>
));

jest.mock("three-spritetext", () => {
  return { default: class MockSpriteText {} };
});

describe("SuiGraphPage Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useTheme.mockReturnValue({ resolvedTheme: "light" });
  });

  test("renders without crashing", () => {
    render(<SuiGraphPage />);
    expect(screen.getByText("Generate Mock Data")).toBeInTheDocument();
  });

  test("mint button is disabled when no account is connected", () => {
    render(<SuiGraphPage />);
    fireEvent.click(screen.getByText("Generate Mock Data"));
    expect(screen.queryByText("Mint")).not.toBeInTheDocument();
  });

  test("calls fetchAllMintedNfts on mount", async () => {
    const mockFetch = jest.fn();
    jest
      .spyOn(global, "fetch")
      .mockImplementation(() =>
        Promise.resolve({
          json: () => ({ result: { data: [], nextCursor: null } }),
        })
      );
    render(<SuiGraphPage />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  });

  test("adds new relation on submit", async () => {
    render(<SuiGraphPage />);
    fireEvent.click(screen.getByText("cat"));
    const input = screen.getByPlaceholderText("e.g. bigger");
    fireEvent.change(input, { target: { value: "related" } });
    fireEvent.submit(input.closest("form"));
    await waitFor(() =>
      expect(screen.getByText("related-cat")).toBeInTheDocument()
    );
  });
});
