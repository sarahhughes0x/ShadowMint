import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedShadowMint = await deploy("ShadowMint", {
    from: deployer,
    log: true,
  });

  await hre.deployments.save("ShadowMint", deployedShadowMint);
  console.log(`ShadowMint contract: `, deployedShadowMint.address);
};
export default func;
func.id = "deploy_shadowMint"; // id required to prevent reexecution
func.tags = ["ShadowMint"];
