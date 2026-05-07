import type { ReactNode } from 'react';

export interface SearchInputProps {
  placeholder?: string;
  minLength?: number;
  autofocus?: boolean;
  onSearch?: (...args: unknown[]) => void;
  onClear?: (...args: unknown[]) => void;
}

declare function SearchInput(props: SearchInputProps): JSX.Element;
export default SearchInput;
