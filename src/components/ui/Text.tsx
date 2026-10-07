import { createContext, forwardRef, useContext, type ComponentRef } from 'react';
import { Text as RNText, TextInput as RNTextInput, type TextInputProps, type TextProps } from 'react-native';

/**
 * Text and TextInput in the website's font (Figtree). Import these instead of react-native's.
 *
 * React Native has no global default font, so these add `font-sans` (Figtree Regular) unless the
 * className already picks a weight (font-normal / font-medium / font-semibold / font-bold, which
 * each set their own Figtree family). Nested Text adds nothing, so it still inherits the parent's
 * family the way it inherited its weight before.
 */

const WEIGHT_CLASS = /(^|\s)font-(normal|medium|semibold|bold)(\s|$)/;

const InsideText = createContext(false);

function withFont(className: string | undefined): string {
  if (className && WEIGHT_CLASS.test(className)) return className;
  return className ? `font-sans ${className}` : 'font-sans';
}

export const Text = forwardRef<ComponentRef<typeof RNText>, TextProps>(function Text({ className, ...props }, ref) {
  const nested = useContext(InsideText);
  if (nested) return <RNText ref={ref} className={className} {...props} />;
  return (
    <InsideText.Provider value>
      <RNText ref={ref} className={withFont(className)} {...props} />
    </InsideText.Provider>
  );
});

export const TextInput = forwardRef<ComponentRef<typeof RNTextInput>, TextInputProps>(function TextInput({ className, ...props }, ref) {
  return <RNTextInput ref={ref} className={withFont(className)} {...props} />;
});

/** The instance type, for useRef<TextInput>(). */
export type TextInput = ComponentRef<typeof RNTextInput>;
