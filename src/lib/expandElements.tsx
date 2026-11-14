import { Children, Fragment, cloneElement, isValidElement, type ReactNode } from "react";

/**
 * O gerador de imagem (satori) só aceita tags nativas dentro de <svg>. Esta
 * função "abre" os componentes de função (sem hooks) das artes de perfil até
 * sobrarem só <svg>, <g>, <path>... pra reaproveitar o mesmo desenho do app.
 */
export function expandElements(node: ReactNode, rootProps?: Record<string, unknown>): ReactNode {
  const expanded = expandNode(node);
  return rootProps && isValidElement(expanded) ? cloneElement(expanded, rootProps) : expanded;
}

function expandNode(node: ReactNode): ReactNode {
  if (!isValidElement(node)) return node;
  const element = node as React.ReactElement<{ children?: ReactNode }>;
  const { type } = element;
  if (type === Fragment) return Children.toArray(element.props.children).map((child) => expandNode(child));
  if (typeof type === "function") {
    return expandNode((type as (props: unknown) => ReactNode)(element.props));
  }
  if (element.props.children === undefined) return element;
  const children = Children.toArray(element.props.children).map((child) => expandNode(child));
  return cloneElement(element, undefined, ...children);
}
