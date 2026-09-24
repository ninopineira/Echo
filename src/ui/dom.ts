/** Mini-helper de création d'éléments DOM et SVG. Aucun accès au document au chargement du module. */

/** Contrôle d'exhaustivité des `switch` sur les unions discriminées. */
export function unreachable(value: never): never {
  throw new Error(`Cas non traité : ${JSON.stringify(value)}`);
}

export type Child = Node | string;

export interface ElProps {
  class?: string;
  text?: string;
  attrs?: Readonly<Record<string, string>>;
  /** Propriétés personnalisées CSS (`--delay`…). */
  vars?: Readonly<Record<string, string>>;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class !== undefined) node.className = props.class;
  if (props.text !== undefined) node.textContent = props.text;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  if (props.vars) for (const [k, v] of Object.entries(props.vars)) node.style.setProperty(k, v);
  node.append(...children);
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string | number>> = {},
  children: readonly SVGElement[] = [],
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  node.append(...children);
  return node;
}
