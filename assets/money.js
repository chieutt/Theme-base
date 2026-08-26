(() => {
  const tokenFormatters = {
    amount: (cents, precision = 2, thousands = ',', decimal = '.') => formatWithDelimiters(cents, precision, thousands, decimal),
    amount_no_decimals: (cents) => formatWithDelimiters(cents, 0),
    amount_with_comma_separator: (cents) => formatWithDelimiters(cents, 2, '.', ','),
    amount_no_decimals_with_comma_separator: (cents) => formatWithDelimiters(cents, 0, '.', ','),
    amount_with_apostrophe_separator: (cents) => formatWithDelimiters(cents, 2, "'", '.'),
    amount_no_decimals_with_space_separator: (cents) => formatWithDelimiters(cents, 0, ' ', '.'),
    amount_with_space_separator: (cents) => formatWithDelimiters(cents, 2, ' ', ','),
    amount_with_period_and_space_separator: (cents) => formatWithDelimiters(cents, 2, ' ', '.'),
  };

  function formatWithDelimiters(cents, precision = 2, thousands = ',', decimal = '.') {
    const amount = Number(cents || 0) / 100;
    if (!Number.isFinite(amount)) return '';
    const fixed = amount.toFixed(precision);
    const [whole, fraction] = fixed.split('.');
    const grouped = whole.replace(/(\d)(?=(\d{3})+(?!\d))/g, `$1${thousands}`);
    return fraction ? `${grouped}${decimal}${fraction}` : grouped;
  }

  function fallbackFormat(cents, currency) {
    try {
      return new Intl.NumberFormat(document.documentElement.lang || undefined, {
        style: 'currency',
        currency: currency || 'USD',
      }).format(Number(cents || 0) / 100);
    } catch (_) {
      return formatWithDelimiters(cents);
    }
  }

  function format(cents, options = {}) {
    const theme = window.theme || {};
    const currency = options.currency || theme.currency || window.Shopify?.currency?.active || 'USD';
    const moneyFormat = options.moneyFormat || theme.moneyFormat;
    const showCurrencyCode = options.showCurrencyCode ?? theme.showCurrencyCode === true;
    const numericCents = Number(cents || 0);
    let value = '';

    if (Number.isFinite(numericCents) && moneyFormat && /\{\{\s*\w+\s*\}\}/.test(moneyFormat)) {
      value = moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token) => tokenFormatters[token]
        ? tokenFormatters[token](numericCents)
        : match);
    } else {
      value = fallbackFormat(numericCents, currency);
    }

    return showCurrencyCode && currency ? `${value} ${currency}` : value;
  }

  window.SpinelMoney = window.SpinelMoney || { format };
})();
