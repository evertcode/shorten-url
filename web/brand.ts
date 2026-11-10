const host = location.host;
const page = document.documentElement.dataset.page;

document.title = page ? `${page} · ${host}` : host;

document.querySelectorAll<HTMLElement>('[data-host]').forEach((element) => {
	element.textContent = host;
});
