declare module '*.yml' {
  const value: Record<string, unknown>;
  export default value;
}

declare module '*.yaml' {
  const value: Record<string, unknown>;
  export default value;
}

declare module '*.svg?react' {
  import type {FunctionComponent, SVGProps} from 'react';
  const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement> & {title?: string}>;
  export default ReactComponent;
}

declare module '*.svg?url' {
  const src: string;
  export default src;
}
