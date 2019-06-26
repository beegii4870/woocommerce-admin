/** @format */
/**
 * External dependencies
 */
import { Component, createElement } from '@wordpress/element';
import { parse, stringify } from 'qs';
import { find, isEqual, last } from 'lodash';
import { applyFilters } from '@wordpress/hooks';
import { matchPath } from 'react-router-dom';

/**
 * WooCommerce dependencies
 */
import { getNewPath, getPersistedQuery, getHistory } from '@woocommerce/navigation';

/**
 * Internal dependencies
 */
import Analytics from 'analytics';
import AnalyticsReport from 'analytics/report';
import AnalyticsSettings from 'analytics/settings';
import Dashboard from 'dashboard';
import DevDocs from 'devdocs';

const TIME_EXCLUDED_SCREENS_FILTER = 'woocommerce_admin_time_excluded_screens';

const getPages = () => {
	const pages = [];

	if ( window.wcAdminFeatures.devdocs ) {
		pages.push( {
			container: DevDocs,
			path: '/devdocs',
			wpOpenMenu: 'toplevel_page_woocommerce',
			wpClosedMenu: 'toplevel_page_wc-admin-path--analytics-revenue',
		} );
		pages.push( {
			container: DevDocs,
			path: '/devdocs/:component',
			wpOpenMenu: 'toplevel_page_woocommerce',
			wpClosedMenu: 'toplevel_page_wc-admin-path--analytics-revenue',
		} );
	}

	if ( window.wcAdminFeatures[ 'analytics-dashboard' ] ) {
		pages.push( {
			container: Dashboard,
			path: '/',
			wpOpenMenu: 'toplevel_page_woocommerce',
			wpClosedMenu: 'toplevel_page_wc-admin-path--analytics-revenue',
		} );
	}

	if ( window.wcAdminFeatures.analytics ) {
		pages.push( {
			container: Analytics,
			path: '/analytics',
			wpOpenMenu: 'toplevel_page_wc-admin-path--analytics-revenue',
			wpClosedMenu: 'toplevel_page_woocommerce',
		} );
		pages.push( {
			container: AnalyticsSettings,
			path: '/analytics/settings',
			wpOpenMenu: 'toplevel_page_wc-admin-path--analytics-revenue',
			wpClosedMenu: 'toplevel_page_woocommerce',
		} );
		pages.push( {
			container: AnalyticsReport,
			path: '/analytics/:report',
			wpOpenMenu: 'toplevel_page_wc-admin-path--analytics-revenue',
			wpClosedMenu: 'toplevel_page_woocommerce',
		} );
	}

	return pages;
};

class Controller extends Component {
	componentDidMount() {
		window.document.documentElement.scrollTop = 0;
	}

	componentDidUpdate( prevProps ) {
		const prevQuery = this.getQuery( prevProps.location.search );
		const prevBaseQuery = this.getBaseQuery( prevProps.location.search );
		const baseQuery = this.getBaseQuery( this.props.location.search );

		if ( prevQuery.page > 1 && ! isEqual( prevBaseQuery, baseQuery ) ) {
			getHistory().replace( getNewPath( { page: 1 } ) );
		}

		if ( prevProps.match.url !== this.props.match.url ) {
			window.document.documentElement.scrollTop = 0;
		}
	}

	getQuery( searchString ) {
		if ( ! searchString ) {
			return {};
		}

		const search = searchString.substring( 1 );
		return parse( search );
	}

	getBaseQuery( searchString ) {
		const query = this.getQuery( searchString );
		delete query.page;
		return query;
	}

	// getRouteMatch( query ) {
	// 	const pages = getPages();
	// 	let routeMatch = null;
	//
	// 	const path = query.path ? query.path : '/';
	// 	pages.forEach( page => {
	// 		const matched = matchPath( path, { path: page.path, exact: true } );
	// 		if ( matched ) {
	// 			routeMatch = matched;
	// 			return;
	// 		}
	// 	} );
	//
	// 	return routeMatch;
	// }

	// @todo What should we display or do when a route/page doesn't exist?
	render404() {
		return null;
	}

	render() {
		console.log( 'rending' );
		const { location, match } = this.props;
		const query = this.getBaseQuery( location.search );

		// Not sure this belongs here, will never get called.
		if ( ! match ) {
			return this.render404();
		}

		const { path, url, params } = match;
		const page = find( getPages(), { path } );

		if ( ! page ) {
			return this.render404();
		}

		window.wpNavMenuUrlUpdate( page, query );
		window.wpNavMenuClassChange( page, url );
		return createElement( page.container, { params, path: url, pathMatch: page.path, query } );
	}
}

/**
 * Update an anchor's link in sidebar to include persisted queries. Leave excluded screens
 * as is.
 *
 * @param {HTMLElement} item - Sidebar anchor link.
 * @param {object} nextQuery - A query object to be added to updated hrefs.
 * @param {Array} excludedScreens - wc-admin screens to avoid updating.
 */
export function updateLinkHref( item, nextQuery, excludedScreens ) {
	const isWCAdmin = /admin.php\?page=wc-admin/.test( item.href );

	if ( isWCAdmin ) {
		const search = last( item.href.split( '?' ) );
		const query = parse( search );
		const path = query.path || 'dashboard';
		const screen = path.replace( '/analytics', '' ).replace( '/', '' );

		const isExcludedScreen = excludedScreens.includes( screen );

		const href =
			'admin.php?' + stringify( Object.assign( query, isExcludedScreen ? {} : nextQuery ) );

		// Replace the href so you can see the url on hover.
		item.href = href;

		item.onclick = e => {
			e.preventDefault();
			getHistory().push( href );
		};
	}
}

// Update's wc-admin links in wp-admin menu
window.wpNavMenuUrlUpdate = function( page, query ) {
	const excludedScreens = applyFilters( TIME_EXCLUDED_SCREENS_FILTER, [
		'devdocs',
		'stock',
		'settings',
		'customers',
	] );
	const nextQuery = getPersistedQuery( query );

	Array.from(
		document.querySelectorAll( `#${ page.wpOpenMenu } a, #${ page.wpClosedMenu } a` )
	).forEach( item => updateLinkHref( item, nextQuery, excludedScreens ) );
};

// When the route changes, we need to update wp-admin's menu with the correct section & current link
window.wpNavMenuClassChange = function( page, url ) {
	Array.from( document.getElementsByClassName( 'current' ) ).forEach( function( item ) {
		item.classList.remove( 'current' );
	} );

	const submenu = Array.from( document.querySelectorAll( '.wp-has-current-submenu' ) );
	submenu.forEach( function( element ) {
		element.classList.remove( 'wp-has-current-submenu' );
		element.classList.remove( 'wp-menu-open' );
		element.classList.remove( 'selected' );
		element.classList.add( 'wp-not-current-submenu' );
		element.classList.add( 'menu-top' );
	} );

	const pageUrl = '/' === url ? 'admin.php?page=wc-admin' : 'admin.php?page=wc-admin&path=' + url;
	const currentItemsSelector =
		url === '/'
			? `li > a[href$="${ pageUrl }"], li > a[href*="${ pageUrl }?"]`
			: `li > a[href*="${ pageUrl }"]`;
	const currentItems = document.querySelectorAll( currentItemsSelector );

	Array.from( currentItems ).forEach( function( item ) {
		item.parentElement.classList.add( 'current' );
	} );

	if ( page.wpOpenMenu ) {
		const currentMenu = document.querySelector( '#' + page.wpOpenMenu );
		currentMenu.classList.remove( 'wp-not-current-submenu' );
		currentMenu.classList.add( 'wp-has-current-submenu' );
		currentMenu.classList.add( 'wp-menu-open' );
		currentMenu.classList.add( 'current' );
	}

	// Sometimes navigating from the subMenu to Dashboard does not close subMenu
	if ( page.wpClosedMenu ) {
		const closedMenu = document.querySelector( '#' + page.wpClosedMenu );
		closedMenu.classList.remove( 'wp-has-current-submenu' );
		closedMenu.classList.remove( 'wp-menu-open' );
		closedMenu.classList.add( 'wp-not-current-submenu' );
	}

	const wpWrap = document.querySelector( '#wpwrap' );
	wpWrap.classList.remove( 'wp-responsive-open' );
};

export { Controller, getPages };
