/**
 *
 * Initializer
 *
 */

import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { pluginId } from '../../pluginId';

//@ts-ignore
const Initializer = ({ setPlugin }) => {
	const ref = useRef();
	ref.current = setPlugin;

	useEffect(() => {
		//@ts-ignore
		ref.current(pluginId);
	}, []);

	return null;
};

Initializer.propTypes = {
	setPlugin: PropTypes.func.isRequired,
};

export default Initializer;
