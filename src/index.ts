/**
 * dsh-usage-toggle — node (host) half. Pure client-side UI plugin.
 *
 * The empty apply exists only so this package registers a row on the host
 * roster; the browser half ships via exports["./client"], which the client
 * module system discovers through the package.json `dsh.client` declaration.
 */
export function apply(): void {}
