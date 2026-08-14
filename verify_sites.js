const catalogue = require('./sites.json');

if (!Array.isArray(catalogue.sites)) {
    throw new Error('sites.json does not contain a sites array.');
}
if (catalogue.sites.length !== 4363) {
    throw new Error(`Expected 4,363 sites but found ${catalogue.sites.length}.`);
}
const invalidSite = catalogue.sites.find((site) => (
    !site.siteId
    || !Number.isFinite(site.latitude)
    || !Number.isFinite(site.longitude)
    || site.latitude < -90
    || site.latitude > 90
    || site.longitude < -180
    || site.longitude > 180
));
if (invalidSite) {
    throw new Error(`Invalid site record: ${JSON.stringify(invalidSite)}`);
}

console.log(`Site catalogue OK: ${catalogue.sites.length} valid site locations.`);
