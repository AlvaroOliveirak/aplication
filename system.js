import si from 'systeminformation';

setInterval(async () => {
  const cpu = await si.currentLoad();
  const mem = await si.mem();

  console.log(`CPU: ${cpu.currentLoad.toFixed(2)}%`);
  console.log(`Uso de RAM: ${(mem.used / mem.total * 100).toFixed(2)}%`);
}, 1000);










export default si;