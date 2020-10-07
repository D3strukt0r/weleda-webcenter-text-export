import React, {useCallback, useState} from 'react';
import {AppBar, CssBaseline, Toolbar, Typography, Link, Container, makeStyles} from '@material-ui/core';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import Dropzone from 'react-dropzone';
import logo from '../../images/weleda_logo.svg';

const useStyles = makeStyles(theme => ({
    footer: {
        backgroundColor: theme.palette.background.paper,
        paddingTop: theme.spacing(2),
        paddingBottom: theme.spacing(2),
    },
    resultParagraph: {
        paddingBottom: theme.spacing(2),
    },
}));

function extractAndShowTextFromXml(xmlNode: any): string {
    if (xmlNode.nodeType === Node.TEXT_NODE) {
        // If it's a text, work with it
        let tempText = xmlNode.textContent.trim();
        if (tempText.length === 0) {
            // If it's an empty text, skip this branch
            return "";
        } else {
            // Otherwise show it
            return tempText + "\n";
        }
    } else {
        // Otherwise go deeper in the tree
        let text = "";
        for (let j = 0; j < xmlNode.childNodes.length; j++) {
            text += extractAndShowTextFromXml(xmlNode.childNodes[j]);
        }
        return text;
    }
}

export default function App() {
    const classes = useStyles();
    const [result, setResult] = useState("");

    const onDrop = useCallback((acceptedFiles) => {
        acceptedFiles.forEach((file: File) => {
            // Get the file
            let reader = new FileReader();

            // Once it's loaded, do something
            reader.onabort = () => console.log('File reading was aborted');
            reader.onerror = () => console.log('File reading has failed');
            reader.onload = () => {
                // Parse the xml into an object
                let readXml = reader.result;
                if (typeof readXml !== "string") {
                    return;
                }
                let parser = new DOMParser();
                let xmlDoc = parser.parseFromString(readXml, "application/xml");

                // Find all the elements which contain the text we want
                let textNodes = xmlDoc.getElementsByTagName("textContent");

                // Clear the result (for when we use it multiple times
                setResult("");

                // Extract the text out of it
                let tempResult = "";
                for (let i = 0; i < textNodes.length; i++) {
                    tempResult += extractAndShowTextFromXml(textNodes[i]);
                }

                setResult(tempResult);
            };

            // Read the file
            reader.readAsText(file);
        })
    }, []);
    return (
            <React.Fragment>
                <CssBaseline/>
                <AppBar position="relative">
                    <Toolbar>
                        <img src={logo} alt="Logo" />
                        <Typography variant="h6" color="inherit" noWrap>
                            Web Center XML to text converter
                        </Typography>
                    </Toolbar>
                </AppBar>
                <main>
                    <Dropzone onDrop={onDrop}>
                        {({getRootProps, getInputProps}) => (
                                <section>
                                    <div {...getRootProps()} className="upload-container">
                                        <div className="dropzone-area">
                                            <React.Fragment>
                                                <CloudUploadIcon style={{fontSize: 100, marginBottom: 0}}/>
                                                <input {...getInputProps()} />
                                                <p>Click or drag the XML file to this area to upload.</p>
                                            </React.Fragment>
                                        </div>
                                    </div>
                                </section>
                        )}
                    </Dropzone>
                </main>
                {/* Result */}
                <Container maxWidth="md">
                    {result.split('\n').map((item, i) => {
                        return <Typography key={i} className={classes.resultParagraph}>{item}</Typography>;
                    })}
                </Container>
                {/* Footer */}
                <footer className={classes.footer}>
                    <Typography variant="body2" color="textSecondary" align="center">
                        {'Copyright © '}
                        <Link color="inherit" href="https://github.com/D3strukt0r">
                            Manuele Vaccari
                        </Link>{' '}
                        {new Date().getFullYear()}
                        {'.'}
                    </Typography>
                </footer>
                {/* End footer */}
            </React.Fragment>
    );
}
