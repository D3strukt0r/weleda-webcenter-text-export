import {red, green} from '@material-ui/core/colors';
import {createMuiTheme} from '@material-ui/core/styles';

// A custom theme for this app
const theme = createMuiTheme({
    palette: {
        primary: {
            main: green["800"]
        },
        secondary: {
            main: green["300"]
        },
        error: {
            main: red.A400,
        },
        background: {
            default: '#fff',
        },
    },
});

export default theme;
