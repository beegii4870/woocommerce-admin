/**
 * External dependencies
 */
import { __ } from '@wordpress/i18n';
import {
	Button,
	Card,
	CardBody,
	CardFooter,
	CheckboxControl,
	FlexItem,
	Icon,
	Tooltip,
} from '@wordpress/components';
import { Component, Fragment } from '@wordpress/element';
import { compose } from '@wordpress/compose';
import { withDispatch, withSelect } from '@wordpress/data';
import { H, Form } from '@woocommerce/components';
import { getCurrencyData } from '@woocommerce/currency';
import { ONBOARDING_STORE_NAME, SETTINGS_STORE_NAME } from '@woocommerce/data';
import { recordEvent } from '@woocommerce/tracks';

/**
 * Internal dependencies
 */
import { getCountryCode, getCurrencyRegion } from '../../dashboard/utils';
import {
	StoreAddress,
	validateStoreAddress,
} from '../../dashboard/components/settings/general/store-address';
import UsageModal from './usage-modal';
import { CurrencyContext } from '../../lib/currency-context';

class StoreDetails extends Component {
	constructor( props ) {
		super( props );
		const { profileItems, settings } = props;

		this.state = {
			showUsageModal: false,
			skipping: false,
		};

		// Check if a store address is set so that we don't default
		// to WooCommerce's default country of the UK.
		const countryState =
			( settings.woocommerce_store_address &&
				settings.woocommerce_default_country ) ||
			'';

		this.initialValues = {
			addressLine1: settings.woocommerce_store_address || '',
			addressLine2: settings.woocommerce_store_address_2 || '',
			city: settings.woocommerce_store_city || '',
			countryState,
			postCode: settings.woocommerce_store_postcode || '',
			isClient: profileItems.setup_client || false,
		};

		this.onContinue = this.onContinue.bind( this );
		this.onSubmit = this.onSubmit.bind( this );
	}

	deriveCurrencySettings( countryState ) {
		if ( ! countryState ) {
			return null;
		}

		const region = getCurrencyRegion( countryState );
		const currencyData = getCurrencyData();
		return currencyData[ region ] || currencyData.US;
	}

	onSubmit() {
		this.setState( {
			showUsageModal: true,
			skipping: false,
		} );
	}

	async onContinue( values ) {
		const {
			createNotice,
			goToNextStep,
			isSettingsError,
			updateProfileItems,
			isProfileItemsError,
			updateAndPersistSettingsForGroup,
			profileItems,
			settings,
		} = this.props;

		const currencySettings = this.deriveCurrencySettings(
			values.countryState
		);
		const Currency = this.context;
		Currency.setCurrency( currencySettings );

		recordEvent( 'storeprofiler_store_details_continue', {
			store_country: getCountryCode( values.countryState ),
			derived_currency: currencySettings.code,
			setup_client: values.isClient,
		} );

		await updateAndPersistSettingsForGroup( 'general', {
			general: {
				...settings,
				woocommerce_store_address: values.addressLine1,
				woocommerce_store_address_2: values.addressLine2,
				woocommerce_default_country: values.countryState,
				woocommerce_store_city: values.city,
				woocommerce_store_postcode: values.postCode,
				woocommerce_currency: currencySettings.code,
				woocommerce_currency_pos: currencySettings.symbolPosition,
				woocommerce_price_thousand_sep:
					currencySettings.thousandSeparator,
				woocommerce_price_decimal_sep:
					currencySettings.decimalSeparator,
				woocommerce_price_num_decimals: currencySettings.precision,
			},
		} );

		const profileItemsToUpdate = { setup_client: values.isClient };
		const region = getCurrencyRegion( values.countryState );

		/**
		 * If a user has already selected cdb industry and returns to change to a
		 * non US store, remove cbd industry.
		 *
		 * NOTE: the following call to `updateProfileItems` does not respect the
		 * `await` and performs an update aysnchronously. This means the following
		 * screen may not be initialized with correct profile settings.
		 *
		 * This comment may be removed when a refactor to wp.data datatores is complete.
		 */
		if (
			region !== 'US' &&
			profileItems.industry &&
			profileItems.industry.length
		) {
			const cbdSlug = 'cbd-other-hemp-derived-products';
			const trimmedIndustries = profileItems.industry.filter(
				( industry ) => {
					return cbdSlug !== industry && cbdSlug !== industry.slug;
				}
			);
			profileItemsToUpdate.industry = trimmedIndustries;
		}

		await updateProfileItems( profileItemsToUpdate );

		if ( ! isSettingsError && ! isProfileItemsError ) {
			goToNextStep();
		} else {
			createNotice(
				'error',
				__(
					'There was a problem saving your store details.',
					'woocommerce-admin'
				)
			);
		}
	}

	render() {
		const { showUsageModal, skipping } = this.state;
		const { skipProfiler } = this.props;

		/* eslint-disable @wordpress/i18n-no-collapsible-whitespace */
		const skipSetupText = __(
			'Manual setup is only recommended for\n experienced WooCommerce users or developers.',
			'woocommerce-admin'
		);

		const configureCurrencyText = __(
			'Your store address will help us configure currency\n options and shipping rules automatically.\n This information will not be publicly visible and can\n easily be changed later.',
			'woocommerce-admin'
		);
		/* eslint-enable @wordpress/i18n-no-collapsible-whitespace */

		return (
			<Fragment>
				<H className="woocommerce-profile-wizard__header-title">
					{ __( 'Welcome to WooCommerce', 'woocommerce-admin' ) }
				</H>
				<H className="woocommerce-profile-wizard__header-subtitle">
					{ __(
						"Tell us about your store and we'll get you set up in no time",
						'woocommerce-admin'
					) }

					<Tooltip text={ configureCurrencyText }>
						<span
							aria-label={ configureCurrencyText }
							className="woocommerce-profile-wizard__tooltip-icon"
						>
							<Icon icon="info-outline" size={ 16 } />
						</span>
					</Tooltip>
				</H>

				<Form
					initialValues={ this.initialValues }
					onSubmitCallback={ this.onSubmit }
					validate={ validateStoreAddress }
				>
					{ ( {
						getInputProps,
						handleSubmit,
						values,
						isValidForm,
						setValue,
					} ) => (
						<Card>
							{ showUsageModal && (
								<UsageModal
									onContinue={ () => {
										if ( skipping ) {
											skipProfiler();
										} else {
											this.onContinue( values );
										}
									} }
									onClose={ () =>
										this.setState( {
											showUsageModal: false,
											skipping: false,
										} )
									}
								/>
							) }
							<CardBody>
								<StoreAddress
									getInputProps={ getInputProps }
									setValue={ setValue }
								/>
							</CardBody>

							<CardFooter>
								<FlexItem align="center">
									<div className="woocommerce-profile-wizard__client">
										<CheckboxControl
											label={ __(
												"I'm setting up a store for a client",
												'woocommerce-admin'
											) }
											{ ...getInputProps( 'isClient' ) }
										/>
									</div>
								</FlexItem>
							</CardFooter>

							<CardFooter justify="center">
								<FlexItem>
									<div className="woocommerce-profile-wizard__submit">
										<Button
											isPrimary
											onClick={ handleSubmit }
											disabled={ ! isValidForm }
										>
											{ __(
												'Continue',
												'woocommerce-admin'
											) }
										</Button>
									</div>
								</FlexItem>
							</CardFooter>
						</Card>
					) }
				</Form>
				<div className="woocommerce-profile-wizard__footer">
					<Button
						isLink
						className="woocommerce-profile-wizard__footer-link"
						onClick={ () => {
							this.setState( {
								showUsageModal: true,
								skipping: true,
							} );
							return false;
						} }
					>
						{ __( 'Skip setup wizard', 'woocommerce-admin' ) }
					</Button>
					<Tooltip text={ skipSetupText }>
						<span
							aria-label={ skipSetupText }
							className="woocommerce-profile-wizard__tooltip-icon"
						>
							<Icon icon="info-outline" size={ 16 } />
						</span>
					</Tooltip>
				</div>
			</Fragment>
		);
	}
}

StoreDetails.contextType = CurrencyContext;

export default compose(
	withSelect( ( select ) => {
		const { getSettings, getSettingsError } = select( SETTINGS_STORE_NAME );
		const { getOnboardingError, getProfileItems } = select(
			ONBOARDING_STORE_NAME
		);

		const profileItems = getProfileItems();
		const isProfileItemsError = Boolean(
			getOnboardingError( 'updateProfileItems' )
		);

		const { general: settings = {} } = getSettings( 'general' );
		const isSettingsError = Boolean( getSettingsError( 'general' ) );

		return {
			isProfileItemsError,
			isSettingsError,
			profileItems,
			settings,
		};
	} ),
	withDispatch( ( dispatch ) => {
		const { createNotice } = dispatch( 'core/notices' );
		const { updateProfileItems } = dispatch( ONBOARDING_STORE_NAME );
		const { updateAndPersistSettingsForGroup } = dispatch(
			SETTINGS_STORE_NAME
		);

		return {
			createNotice,
			updateProfileItems,
			updateAndPersistSettingsForGroup,
		};
	} )
)( StoreDetails );
