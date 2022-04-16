const xlsx = require("node-xlsx");
const ethers = require("ethers");
const fs = require("fs");
const Log = require("@ntbl/log");
const log = Log({
    name: 'material',
    interval: 80,
    color: 'cyan'
});

// const url = 'https://bsc-dataseed1.binance.org:443';
const url = 'https://data-seed-prebsc-1-s1.binance.org:8545';
const contractAddress = "0xCAa09e779408Db48C6ad303e8ac93bfD0d89F753"


const Provider = new ethers.providers.JsonRpcProvider(url);

const contents = fs.readFileSync("./abi/erc20.json");
const abi = JSON.parse(contents);
const contract = new ethers.Contract(contractAddress,abi);


// let errorArr = [];

// const transferAccount = async(privateKey,address,i)=>{
//     const newWallet = new ethers.Wallet(privateKey, Provider);
//     // const balance = await contract.connect(newWallet).balanceOf(address);
//
//     try{
//         const ap = await contract.connect(newWallet).approve(address,1,{ gasLimit: 1000000})
//         const amount = ethers.utils.parseEther('10')
//         const result = await contract.connect(newWallet).transfer('0x369fa734d16b0003836da3fa473318a05e136465',amount.toString(),{ gasLimit: 1000000});
//         result.wait();
//
//     }catch(e){
//         errorArr.push({address,privateKey,i})
//     }
//     if(i===101){
//
//         writeJson(errorArr)
//     }
//     log.stop(false)
//     console.log("=========",i,address)
// }

const balance0 = [];
const balanceArr= [];
const queryBalance = async (item,i,name) =>{

    const { address,privateKey} = item;

    const bal = await Provider.getBalance(address);
    console.log("===",i,item.address,bal.toString())
    if(bal.toString() === '0'){
        balance0.push({
            address,
            privateKey,
            i,
            balance:bal.toString()
        })
        writeJson(balance0,`${name}_balance_0`)
    }else{
        balanceArr.push({
            address,
            privateKey,
            i,
            balance:bal.toString()
        })
        writeJson(balanceArr,`${name}_balance_next`)
    }

}
const CheckQuery = (methodName) =>{
    const typeObj = abi.filter(item=>item.name === methodName);
    const isFunc = typeObj[0].type === "function";
    let notQueryNative;

    if(isFunc){
        notQueryNative = typeObj[0].stateMutability === "view";
    }else{
        notQueryNative = false;
    }
    return {
        notQueryNative,
        inputArr:typeObj[0].inputs
    };
}

const ExecuteFunc = async(FuncName,privateArr,methodName,methodValues) =>{

    const {notQueryNative,inputArr} = CheckQuery(methodName);
    if(inputArr.length !== methodValues.length){
        console.error("Parameters is error");
    }
    let userArr;

    if(!notQueryNative){
        for await (let [index,item] of privateArr.entries()){
            await queryBalance(item,index,FuncName)
        }
        const contents = fs.readFileSync(`./user/${FuncName}_balance_next.json`);
        userArr = JSON.parse(contents);
    }else{
        userArr = privateArr;
    }

    let contractResult = [];
    let errorResult = [];
    for await (let [index,user] of userArr.entries()){
        const params = [];
        methodValues.map(value =>{
            if(value === '---accountAddress---'){
                params.push(user.address)
            }else{
                params.push(value)
            }
        });

        const newWallet = new ethers.Wallet(user.privateKey, Provider);
        if(!notQueryNative){

            try{
                const result = await contract.connect(newWallet).functions[methodName](...params);
                const receipt = await result.wait();
                console.log("===receipt==",receipt)
                contractResult.push({user})
                writeJson(contractResult,`${FuncName}_result`)
            }catch (e){
                errorResult.push(user)
                writeJson(errorResult,`${FuncName}_error_result`)
            }

        }else{
            try{
                const result = await contract.connect(newWallet).functions[methodName](...params);
                contractResult.push({user,result:result.toString()})
                writeJson(contractResult,`${FuncName}_result`)
                console.log("===result==",index,result.toString())
            }catch (e){
                errorResult.push(user)
                writeJson(errorResult,`${FuncName}_error_result`)
            }

        }
    }

}


const writeJson = (data,fileName) =>{
    fs.writeFileSync(`./user/${fileName}.json`, JSON.stringify(data), (err) => {
        if (err) {
            throw err;
        }
        console.log("JSON data is saved.");
    });
}

const getUser = async () =>{
    const workSheetsFromFile = xlsx.parse(`./user/user.csv`);
    const userList = workSheetsFromFile[0].data;
    userList.shift();

    let userListData = [];

    userList.map((item,index)=>{
        userListData.push({
            address:item[0],
            privateKey:item[2],
            index
        })
    })

    // log.start(data => `${data.frame} downloading data from contract`);
    const amount = ethers.utils.parseEther('10')
    await ExecuteFunc("step1",userListData,'approve',["---accountAddress---",amount])
}

getUser()



