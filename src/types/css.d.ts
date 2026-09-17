/**
 * Next ships declarations for `*.module.css` but not for plain stylesheets, so
 * a side-effect import of `globals.css` trips TS2882. Declaring it here keeps
 * `tsc --noEmit` honest without relaxing the compiler options.
 */
declare module '*.css'
