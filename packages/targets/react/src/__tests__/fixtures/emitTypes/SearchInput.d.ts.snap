import type { ReactNode } from 'react';

export interface SearchInputProps extends Omit<import('react').ComponentPropsWithoutRef<'div'>, 'placeholder' | 'minLength' | 'autofocus' | 'onSearch' | 'onClear' | 'children' | 'dangerouslySetInnerHTML'> {
  placeholder?: string;
  minLength?: number;
  autofocus?: boolean;
  onSearch?: (...args: any[]) => void;
  onClear?: (...args: any[]) => void;
}

declare function SearchInput(props: SearchInputProps): JSX.Element;
export default SearchInput;
