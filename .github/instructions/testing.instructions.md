---
applyTo: "**/*.test.ts,**/*.test.tsx,**/*.spec.ts,**/*.spec.tsx,**/test/**,**/tests/**,**/__tests__/**"
---

# Testing Instructions

## Server Testing (Jest + React Testing Library)

### API Route Tests

```typescript
// app/api/games/route.test.ts
import { GET } from "./route";

describe("GET /api/games", () => {
	it("returns list of games", async () => {
		const response = await GET(new Request("http://localhost/api/games"));
		const data = await response.json();
		expect(data.games).toBeInstanceOf(Array);
	});
});
```

### Component Tests

```typescript
import { render, screen } from "@testing-library/react";
import { GameCard } from "./GameCard";

test("renders game title", () => {
	render(<GameCard game={{ title: "Super Mario" }} />);
	expect(screen.getByText("Super Mario")).toBeInTheDocument();
});
```

## Mobile Testing (Jest + React Native Testing Library)

### Component Tests

```typescript
import { render, fireEvent } from "@testing-library/react-native";
import { VirtualButton } from "./VirtualButton";

test("calls onInput when pressed", () => {
	const onInput = jest.fn();
	const { getByTestId } = render(<VirtualButton onInput={onInput} />);
	fireEvent.press(getByTestId("button-a"));
	expect(onInput).toHaveBeenCalledWith("A", true);
});
```

## Test File Naming

- Unit tests: `*.test.ts` or `*.test.tsx`
- Integration tests: `*.integration.test.ts`
- E2E tests: `*.e2e.ts` (in `/e2e` directory)
