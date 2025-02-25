declare module "prismjs/components/prism-core" {
  export const languages: { [key: string]: any };
  export function highlight(
    code: string,
    grammar: any,
    language?: string,
  ): string;
}
