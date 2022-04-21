const xlsx = require("node-xlsx");
const ethers = require("ethers");
require("dotenv").config();

const args = require('args-parser')(process.argv);
console.info(args);


const fs = require("fs");


console.info(process.env.PROVIDER_URL)
const Provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);


const writeJSONFile = (data, fileName) => {
    fs.writeFileSync(`./user/${fileName}.json`, JSON.stringify(data, null, 4), (err) => {
        if (err) {
            throw err;
        }
        console.log("JSON data is saved.");
    });
}


const runCommand = async (cmd) => {
    console.log("===runCommand==", cmd);

    let abi = JSON.parse(fs.readFileSync(`${cmd.Abi}`));

    const typeObj = abi.filter(item => item.name === cmd.Method);

    //TODO: add defense here.
    const isFunc = typeObj[0].type === "function";

    let isWrite = typeObj[0].stateMutability !== "view";
    inputArr = typeObj[0].inputs;
    if (inputArr.length !== cmd.Params.length) {
        console.error("Parameters is error");
    }

    const wallet = new ethers.Wallet(cmd.PrivateKey, Provider);
    const contract = new ethers.Contract(cmd.Contract, abi);
    const methodName = cmd.Method;

    let params = [];
    cmd.Params.map(value => {
        if (value === '---msg.sender---') {
            params.push(wallet.address);
        } else {
            params.push(value)
        }
    });

    if (isWrite) {
        const nativeTokenBalance = await Provider.getBalance(wallet.address);
        console.log("===nativeTokenBalance==", ethers.utils.formatEther(nativeTokenBalance.toString()));
        if (nativeTokenBalance.lt(ethers.BigNumber.from("0.01"))) { // TODO: add check value here.
            return Error("Insufficient balance");
        }

        try {
            const result = await contract.connect(wallet).functions[methodName](...params);
            const receipt = await result.wait();
            console.log("===receipt==", receipt);
        } catch (e) {
            console.error("===error==", e);
            return e;
        }
    } else {
        try {
            const result = await contract.connect(wallet).functions[methodName](...params);
            console.log("===result==", result.toString());
        } catch (e) {
            console.error("===error==", e);
            return e;
        }
    }
}

const runCommands = async (commands) => {
    // console.log("===runCommands==", commands);
    for (let i = 0; i < commands.length; i++) {
        let result = await runCommand(commands[i]);
        // TODO: if fail, write to error files

    }

}

const serializeCommnands = async (configFile, privateKeysFile) => {
    const contents = fs.readFileSync(configFile);
    const configs = JSON.parse(contents);

    let privateKeys = [];
    const workSheetsFromFile = xlsx.parse(privateKeysFile);
    const userList = workSheetsFromFile[0].data;
    userList.shift();
    userList.map((item, index) => {
        privateKeys.push(item[2]);
    })

    console.log('===privateKeys==', privateKeys);
    console.log('===configs==', configs);

    let commands = [];
    for (let i = 0; i < configs.length; i++) {
        const stepConfig = configs[i];
        for (let j = 0; j < privateKeys.length; j++) {
            const privateKey = privateKeys[j];
            commands.push({
                Name: stepConfig.name,
                Index: stepConfig.index,
                Contract: stepConfig.contract,
                Abi: stepConfig.abi,
                Method: stepConfig.method,
                Params: stepConfig.params,
                PrivateKey: privateKey,
            })
        }
    }

    writeJSONFile(commands, "commands");
    return commands;
}



const execute = async () => {
    // config & privateKeys
    if (args.config && args.privateKeys) {
        let commands = await serializeCommnands(args.config, args.privateKeys);
        console.log("===commands==", commands);
        await runCommands(commands);
    
    // commands file
    } else if (args.commandsFile) {
        let contents = fs.readFileSync(args.commandsFile);
        let commands = JSON.parse(contents);
        await runCommands(commands);

    } else {
        console.error("Please input correct parameters");
    }
}


const main = async () => {
    await execute();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });