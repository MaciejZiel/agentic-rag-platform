import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageTitle } from "@/hooks/usePageTitle";

describe("usePageTitle", () => {
  it("sets the document title and restores the app name on unmount", () => {
    const { rerender, unmount } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: "Documents" },
    });
    expect(document.title).toBe("Documents | Cortex");

    rerender({ title: "Settings" });
    expect(document.title).toBe("Settings | Cortex");

    unmount();
    expect(document.title).toBe("Cortex");
  });
});
