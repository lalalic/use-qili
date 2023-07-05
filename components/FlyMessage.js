import React, { useEffect } from 'react';
import { View, Text } from "react-native";


export default  Object.assign(function FlyMessage({style, errorStyle}){
    const [message, setMessage] = React.useState({});

    useEffect(() => {
        FlyMessage.setMessage = setMessage;
        return () => FlyMessage.setMessage = () => null;
    }, []);

    const containerStyle=React.useMemo(()=>{
        return { position: "absolute", bottom: 20, width: "100%", color: "yellow", justifyContent: "center", alignItems: "center" }
    },[])

    const content=React.useMemo(()=>{
        if(message.info){
            return <Text style={style}>{message.info}</Text>
        }else if(message.error){
            return <Text style={errorStyle}>{message.error}</Text>
        }
        return null
    },[message])

    return (
        <View style={containerStyle}>
            {content}
        </View>
    )
}, {
    show(info) {
        console.debug(info);
        this.setMessage({info});
        setTimeout(() => this.setMessage({}), 3000);
    },
    error(error) {
        console.error(error);
        this.setMessage({error});
        setTimeout(() => this.setMessage({}), 3000);
    }
});
