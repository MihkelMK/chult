import { getContext, setContext } from 'svelte';

const DI_CONTAINER_KEY = Symbol('DI_CONTAINER');

export class DIContainer {
	private services = new Map<symbol, new (...args: never[]) => unknown>();
	register<T>(key: symbol, service: new (...args: never[]) => T) {
		this.services.set(key, service);
	}
	resolve<T>(key: symbol, ...args: unknown[]): T {
		const Service = this.services.get(key);
		if (!Service) {
			throw new Error(`Service not found for key ${String(key)}`);
		}
		return new Service(...(args as never[])) as T;
	}
}

export function setDIContainer(container: DIContainer) {
	setContext(DI_CONTAINER_KEY, container);
}

export function getDIContainer(): DIContainer {
	return getContext(DI_CONTAINER_KEY);
}
